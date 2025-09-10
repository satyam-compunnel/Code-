document.addEventListener('DOMContentLoaded', () => {
    const tokenSet = '{{ token_set }}';

    if (tokenSet) {
        fetchOrganizations();
    }

    document.getElementById('createRepoForm').addEventListener('submit', function (event) {
        event.preventDefault();
        const org = document.getElementById('organization').value;
        const repoName = document.getElementById('repo_name').value;
        const description = document.getElementById('description').value;

        const collaborators = [];
        const collaboratorForms = document.querySelectorAll('.collaboratorForm');
        collaboratorForms.forEach(form => {
            const username = form.querySelector('input[name="collaborator_username"]').value;
            const permission = form.querySelector('select[name="collaborator_permission"]').value;
            if (username) {
                collaborators.push({ username, permission });
            }
        });

        fetch('/create-repository', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ org, repo_name: repoName, description, collaborators })
        }).then(response => response.json())
        .then(data => {
            if (data.status === 201) {
                alert('Repository created successfully!');
            } else {
                alert('Error creating repository: ' + data.message);
            }
        });
    });

    document.getElementById('managePermissionsForm').addEventListener('submit', function (event) {
        event.preventDefault();
        const repo = document.getElementById('repo_select').value;
        const user = document.getElementById('user').value;
        const permission = document.getElementById('permission').value;

        fetch('/manage-permissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ repo, user, permission })
        }).then(response => {
            if (response.ok) { 
                alert('Permissions updated successfully!');
                fetchCollaborators(repo); 
            } else {
                response.json().then(data => {
                    alert('Error updating permissions: ' + data.message); 
                });
            }
        });
    });

    document.getElementById('organization').addEventListener('change', function () {
        const org = this.value;
        document.getElementById('actionButtons').style.display = org ? 'block' : 'none';
        document.getElementById('createRepoSection').style.display = 'none';
        document.getElementById('managePermissionsSection').style.display = 'none';
        document.getElementById('collaboratorsList').style.display = 'none'; 
        if (org) {
            fetchRepositories(org);
        }
    });

    document.getElementById('createRepoBtn').addEventListener('click', function () {
        document.getElementById('createRepoSection').style.display = 'block';
        document.getElementById('managePermissionsSection').style.display = 'none';
        document.getElementById('collaboratorsList').style.display = 'none'; 
    });

    document.getElementById('managePermissionsBtn').addEventListener('click', function () {
        document.getElementById('createRepoSection').style.display = 'none';
        document.getElementById('managePermissionsSection').style.display = 'block';
        document.getElementById('collaboratorsList').style.display = 'none'; 
    });

    document.getElementById('repo_select').addEventListener('change', function () {
        const repo = this.value;
        if (repo) {
            console.log("Fetching collaborators for repo:", repo); 
            fetchCollaborators(repo);
        } else {
            document.getElementById('collaboratorsList').style.display = 'none';
        }
    });

    document.getElementById('addCollaboratorBtn').addEventListener('click', function () {
        addCollaboratorForm();
    });

    // ✅ Create Organization Form Submission
    document.getElementById('createOrgForm').addEventListener('submit', function (event) {
        event.preventDefault();

        const enterprise_slug = document.getElementById('enterprise_slug').value;
        const org_login = document.getElementById('org_login').value;
        const admin_username = document.getElementById('admin_username').value;
        const profile_name = document.getElementById('profile_name').value;

        fetch('/create-organization', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enterprise_slug, org_login, admin_username, profile_name })
        })
        .then(response => response.json())
        .then(data => {
            const messageDiv = document.getElementById('orgCreationMessage');
            messageDiv.style.display = 'block';
            if (data.status === 201) {
                messageDiv.classList.remove('text-danger');
                messageDiv.classList.add('text-success');
                messageDiv.textContent = 'Organization created successfully!';
            } else {
                messageDiv.classList.remove('text-success');
                messageDiv.classList.add('text-danger');
                messageDiv.textContent = 'Error: ' + data.message;
            }
        })
        .catch(error => {
            const messageDiv = document.getElementById('orgCreationMessage');
            messageDiv.style.display = 'block';
            messageDiv.classList.add('text-danger');
            messageDiv.textContent = 'Unexpected error: ' + error.message;
        });
    });

    // ✅ Create Team Form Submission
    document.getElementById('createTeamForm').addEventListener('submit', function (event) {
        event.preventDefault();

        const org = document.getElementById('organization').value;
        const team_name = document.getElementById('team_name').value;
        const description = document.getElementById('team_description').value;

        const memberInputs = document.querySelectorAll('#teamMembersSection input[name="github_id"]');
        const members = Array.from(memberInputs)
            .map(input => input.value.trim())
            .filter(username => username.length > 0)
            .map(username => ({ github_id: username }));

        fetch('/create-team', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ org, team_name, description, members })
        })
        .then(response => response.json())
        .then(data => {
            const messageDiv = document.getElementById('teamCreationMessage');
            messageDiv.style.display = 'block';
            if (data.status === 201) {
                messageDiv.classList.remove('text-danger');
                messageDiv.classList.add('text-success');
                messageDiv.textContent = 'Team created successfully!';
            } else {
                messageDiv.classList.remove('text-success');
                messageDiv.classList.add('text-danger');
                messageDiv.textContent = 'Error: ' + (data.message || 'Unknown error');
            }
        })
        .catch(error => {
            const messageDiv = document.getElementById('teamCreationMessage');
            messageDiv.style.display = 'block';
            messageDiv.classList.add('text-danger');
            messageDiv.textContent = 'Unexpected error: ' + error.message;
        });
    });

    // ✅ Add Team Member Input Field
    document.getElementById('addTeamMemberBtn').addEventListener('click', function () {
        const input = document.createElement('input');
        input.type = 'text';
        input.name = 'github_id';
        input.className = 'form-control mb-2';
        input.placeholder = 'GitHub username';
        document.getElementById('teamMembersSection').appendChild(input);
    });
});

function fetchOrganizations() {
    fetch('/organizations')
        .then(response => response.json())
        .then(data => {
            const orgSelect = document.getElementById('organization');
            data.forEach(org => {
                const option = document.createElement('option');
                option.value = org.login;
                option.textContent = org.login;
                orgSelect.appendChild(option);
            });
        });
}

function fetchRepositories(org) {
    fetch(`/repositories/${org}`)
        .then(response => response.json())
        .then(data => {
            const repoSelect = document.getElementById('repo_select');
            repoSelect.innerHTML = '<option value="">Select a repository</option>';
            data.forEach(repo => {
                const option = document.createElement('option');
                option.value = repo.full_name;
                option.textContent = repo.name;
                repoSelect.appendChild(option);
            });
        });
}

function fetchCollaborators(repo) {
    fetch(`/collaborators/${repo}`)
        .then(response => {
            if (!response.ok) { 
                console.error("Error fetching collaborators:", response.status, response.statusText);
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const collaboratorItems = document.getElementById('collaboratorItems');
            collaboratorItems.innerHTML = ''; 

            if (data.length > 0) {
                data.forEach(collaborator => {
                    const listItem = document.createElement('li');
                    listItem.classList.add('list-group-item');

                    let permission = collaborator.permission;
                    if (collaborator.type === 'invited') {
                        permission = collaborator.permissions; 
                    }

                    listItem.textContent = `${collaborator.login} (${collaborator.type}) - ${permission}`; 
                    collaboratorItems.appendChild(listItem);                  listItem.textContent = `${collaborator.login} (${collaborator.type}) - ${permission}`; 
                    collaboratorItems.appendChild(listItem);
                });
                document.getElementById('collaboratorsList').style.display = 'block';
            } else {
                document.getElementById('collaboratorsList').style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error fetching collaborators:', error);
            alert('An error occurred while fetching collaborators. Please check the console for details.');
        });
}

function addCollaboratorForm() {
    const collaboratorsSection = document.getElementById('collaboratorsSection');
    const newForm = document.createElement('div');
    newForm.classList.add('collaboratorForm');
    newForm.innerHTML = `
        <label for="collaborator_username">Collaborator Username:</label>
        <input type="text" name="collaborator_username" required placeholder="Enter collaborator username">
        <label for="collaborator_permission">Permission Level:</label>
        <select name="collaborator_permission" required>
            <option value="read">Read</option>
            <option value="write">Write</option>
        </select>
        <button type="button" class="removeCollaboratorBtn">Remove</button>
    `;
    collaboratorsSection.appendChild(newForm);

    newForm.querySelector('.removeCollaboratorBtn').addEventListener('click', function() {
        newForm.remove();
    });
}
