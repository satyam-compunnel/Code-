from flask import Flask, render_template, request, jsonify
import requests
import time

app = Flask(__name__)

GITHUB_API_URL = 'https://api.github.com'
github_token = None

@app.route('/', methods=['GET', 'POST'])
def index():
    global github_token
    if request.method == 'POST':
        github_token = request.form.get('github_token')
        return render_template('index.html', token_set=True)
    return render_template('index.html', token_set=False)

@app.route('/organizations', methods=['GET'])
def get_organizations():
    if github_token:
        headers = {'Authorization': f'token {github_token}'}
        response = requests.get(f'{GITHUB_API_URL}/user/orgs', headers=headers)
        if response.status_code == 200:
            return jsonify(response.json())
    return jsonify([])

@app.route('/repositories/<org>', methods=['GET'])
def get_repositories(org):
    if github_token:
        headers = {'Authorization': f'token {github_token}'}
        url = f'{GITHUB_API_URL}/orgs/{org}/repos'
        response = requests.get(url, headers=headers)

        print("DEBUG:", response.status_code, response.text)

        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({"error": response.text}), response.status_code
    return jsonify({"error": "GitHub token missing"}), 401

@app.route('/create-repository', methods=['POST'])
def create_repository():
    data = request.json
    if github_token:
        headers = {'Authorization': f'token {github_token}'}
        payload = {
            'name': data['repo_name'],
            'description': data['description'],
            'private': True,
            'auto_init': True
        }
        response = requests.post(f'{GITHUB_API_URL}/orgs/{data["org"]}/repos', json=payload, headers=headers)

        if response.status_code == 201:
            for collaborator in data.get('collaborators', []):
                collab_response = requests.put(
                    f'{GITHUB_API_URL}/repos/{data["org"]}/{data["repo_name"]}/collaborators/{collaborator["username"]}',
                    json={'permission': collaborator['permission']},
                    headers=headers
                )
                if collab_response.status_code != 201:
                    return jsonify({'status': collab_response.status_code, 'message': collab_response.json()})

            try:
                default_branch_name = response.json()['default_branch']
                time.sleep(2)

                max_retries = 3
                retries = 0
                while retries < max_retries:
                    branch_details_url = f'{GITHUB_API_URL}/repos/{data["org"]}/{data["repo_name"]}/branches/{default_branch_name}'
                    branch_details_response = requests.get(branch_details_url, headers=headers)

                    if branch_details_response.status_code == 200:
                        default_branch_sha = branch_details_response.json()['commit']['sha']
                        branch_names = ['develop', 'feature', 'hotfix']

                        for branch_name in branch_names:
                            branch_payload = {
                                'ref': f'refs/heads/{branch_name}',
                                'sha': default_branch_sha
                            }
                            branch_response = requests.post(
                                f'{GITHUB_API_URL}/repos/{data["org"]}/{data["repo_name"]}/git/refs',
                                json=branch_payload,
                                headers=headers
                            )
                            if branch_response.status_code != 201:
                                return jsonify({'status': branch_response.status_code,
                                                'message': f'Error creating branch {branch_name}: {branch_response.json()}'})
                        break
                    else:
                        retries += 1
                        time.sleep(1)

                if retries == max_retries:
                    return jsonify({'status': 500, 'message': 'Error getting default branch details after retries. Please try again later.'})

            except KeyError:
                return jsonify({'status': 500, 'message': 'Unexpected GitHub API response format. Could not find default branch information.'})

        return jsonify({'status': response.status_code, 'message': response.json()})
    return jsonify({'status': 401, 'message': 'Unauthorized'})

@app.route('/manage-permissions', methods=['POST'])
def manage_permissions():
    data = request.json
    if github_token:
        headers = {'Authorization': f'token {github_token}'}
        permissions = {'permission': data['permission']}
        try:
            response = requests.put(f'{GITHUB_API_URL}/repos/{data["repo"]}/collaborators/{data["user"]}', 
                                   json=permissions, headers=headers)
            response.raise_for_status() 
            return jsonify({'status': response.status_code, 'message': 'Permissions updated successfully!'})
        except requests.exceptions.RequestException as e:
            return jsonify({'status': response.status_code, 'message': f'Error updating permissions: {str(e)}'})
    return jsonify({'status': 401, 'message': 'Unauthorized'})

@app.route('/collaborators/<org>/<repo>', methods=['GET'])
def get_collaborators(org, repo):
    if not github_token:
        return jsonify([]) 

    headers = {'Authorization': f'token {github_token}'}
    all_collaborators = []

    direct_url = f'{GITHUB_API_URL}/repos/{org}/{repo}/collaborators'
    direct_params = {'affiliation': 'direct'}
    direct_resp = requests.get(direct_url, headers=headers, params=direct_params)
    if direct_resp.status_code == 200:
        all_collaborators.extend([
            {
                'login': c['login'],
                'permission': 'write' if c['permissions']['push'] else 'read',
                'type': 'direct'
            }
            for c in direct_resp.json()
        ])

    outside_params = {'affiliation': 'outside'}
    outside_resp = requests.get(direct_url, headers=headers, params=outside_params)
    if outside_resp.status_code == 200:
        all_collaborators.extend([
            {
                'login': c['login'],
                'permission': 'write' if c['permissions']['push'] else 'read',
                'type': 'outside'
            }
            for c in outside_resp.json()
        ])

    invites_url = f'{GITHUB_API_URL}/repos/{org}/{repo}/invitations'
    invites_resp = requests.get(invites_url, headers=headers)
    if invites_resp.status_code == 200: 
        all_collaborators.extend([
            {
                'login': invite['invitee']['login'],
                'permission': invite['permissions'],
                'type': 'invited'
            }
            for invite in invites_resp.json()
        ])

    return jsonify(all_collaborators)

# ✅ Create Organization Route
@app.route('/create-organization', methods=['POST'])
def create_organization():
    data = request.json
    if not github_token:
        return jsonify({'status': 401, 'message': 'Unauthorized'}), 401

    headers = {'Authorization': f'token {github_token}'}
    payload = {
        'login': data['org_login'],
        'admin': data['admin_username'],
        'profile_name': data.get('profile_name', '')
    }

    url = f'{GITHUB_API_URL}/enterprises/{data["enterprise_slug"]}/orgs'
    response = requests.post(url, json=payload, headers=headers)

    if response.status_code == 201:
        return jsonify({'status': 201, 'message': 'Organization created successfully!'})
    elif response.status_code == 403:
        return jsonify({'status': 403, 'message': 'Access denied. Your token may lack admin:enterprise scope.'})
    elif response.status_code == 404:
        return jsonify({'status': 404, 'message': 'Enterprise slug not found or inaccessible.'})
    else:
        return jsonify({'status': response.status_code, 'message': response.json()})

if __name__ == '__main__':
    app.run(debug=True)
