// Load repositories on page load
window.addEventListener('DOMContentLoaded', () => {
    loadRepositories();
});

// Upload form handler
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const repositoryName = document.getElementById('repositoryName').value;
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file || !repositoryName) {
        showResult('Please provide both repository name and file', 'error');
        return;
    }

    showResult('⏳ Processing... This may take a moment.', 'success');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('repositoryName', repositoryName);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            const message = `
                ✅ Success!<br><br>
                <strong>Convert:</strong> ${result.convert}<br><br>
                <strong>Create:</strong> ${result.create}<br><br>
                <strong>Upload:</strong> ${result.upload}
            `;
            showResult(message, 'success');
            addMessage(`Repository "${repositoryName}" created and data uploaded successfully!`, 'bot');
            
            // Refresh repositories list
            setTimeout(() => loadRepositories(), 1000);
        } else {
            showResult('❌ Error: ' + JSON.stringify(result), 'error');
        }
    } catch (error) {
        showResult('❌ Error: ' + error.message, 'error');
    }
});

// Load repositories
async function loadRepositories() {
    try {
        const response = await fetch('/api/repositories', { method: 'POST' });
        const data = await response.json();

        const select = document.getElementById('chatRepository');
        select.innerHTML = '<option value="">-- Select Repository --</option>';

        if (Array.isArray(data.repositories)) {
            data.repositories.forEach(repo => {
                const option = document.createElement('option');
                option.value = repo.id;
                option.textContent = repo.title || repo.id;
                select.appendChild(option);
            });

            console.log(`✅ Loaded ${data.repositories.length} repositories`);
        }
    } catch (error) {
        console.error('Error loading repositories:', error);
        addMessage('⚠️ Could not load repositories. Make sure GraphDB is running on localhost:7200', 'bot');
    }
}

// Send SPARQL query
async function sendQuery() {
    const query = document.getElementById('chatInput').value.trim();
    const repository = document.getElementById('chatRepository').value;
    const retrievalMethod = document.getElementById('retrievalMethod').value;

    if (!query) {
        addMessage('Please enter a question or SPARQL query', 'bot');
        return;
    }

    if (!repository) {
        addMessage('Please select a repository first', 'bot');
        return;
    }

    // Add user message
    addMessage(query, 'user');
    document.getElementById('chatInput').value = '';

    // Check if it's natural language or SPARQL (only for simple execute)
    const isSparql = query.trim().toUpperCase().match(/^(SELECT|ASK|CONSTRUCT|DESCRIBE|PREFIX)/);

    let loadingText = '⏳ Executing query...';
    if (retrievalMethod === 'execute_sparql') {
        loadingText = isSparql ? '⏳ Executing SPARQL query...' : '🤖 Generating SPARQL from your question...';
    } else if (retrievalMethod === 'sparql_retrieval') {
        loadingText = '🤖 Using GraphDB SPARQL Retrieval...';
    } else if (retrievalMethod === 'plugin_retrieval') {
        loadingText = '🔌 Using GraphDB Plugin Retrieval...';
    }

    // Add loading message
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.textContent = loadingText;
    document.getElementById('chatBox').appendChild(loadingDiv);
    scrollToBottom();

    try {
        const response = await fetch('/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                repository: repository,
                retrievalMethod: retrievalMethod
            })
        });

        const data = await response.json();
        loadingDiv.remove();

        if (response.ok) {
            // Show generated SPARQL if it was natural language (only for simple execute)
            if (retrievalMethod === 'execute_sparql' && !isSparql && data.generatedSparql) {
                addMessage(`✨ Generated SPARQL query:\n<pre>${escapeHtml(data.generatedSparql)}</pre>`, 'bot');
            }

            // Show natural language response if available
            if (data.naturalResponse && data.naturalResponse.trim() !== '') {
                addMessage(`💬 ${data.naturalResponse}`, 'bot');
            }

            // Try to format the result nicely
            let resultText = data.result;

            // If it's JSON, pretty print it
            try {
                const jsonResult = JSON.parse(resultText);
                resultText = JSON.stringify(jsonResult, null, 2);
                addMessage(`📊 Raw Results:\n<pre>${escapeHtml(resultText)}</pre>`, 'bot');
            } catch {
                // Not JSON, just display as is
                addMessage(`📊 Raw Results:\n<pre>${escapeHtml(resultText)}</pre>`, 'bot');
            }
        } else {
            addMessage('❌ Error executing query: ' + (data.error || data.result), 'bot');
        }
    } catch (error) {
        loadingDiv.remove();
        addMessage('❌ Error: ' + error.message, 'bot');
    }
}

// Add message to chat
function addMessage(text, sender) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = text;
    chatBox.appendChild(messageDiv);
    scrollToBottom();
}

// Scroll chat to bottom
function scrollToBottom() {
    const chatBox = document.getElementById('chatBox');
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Show result message
function showResult(message, type) {
    const resultDiv = document.getElementById('uploadResult');
    resultDiv.innerHTML = message;
    resultDiv.className = `result ${type}`;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Allow Enter to send (Ctrl+Enter for new line)
document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        sendQuery();
    }
});


