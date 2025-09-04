// --- PDF.js Setup ---
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;

// --- Global Variable ---
let documentTextForQA = '';

// --- DOM Element References ---
const pdfUpload = document.getElementById('pdf-upload');
const statusMessage = document.getElementById('status-message');
const resultsContainer = document.getElementById('results-container');
const financialContent = document.getElementById('financial-content');
const keyPointsContent = document.getElementById('key-points-content');
const risksContent = document.getElementById('risks-content');
const citationsContent = document.getElementById('citations-content');
const originalTextContent = document.getElementById('original-text-content');
const simplifiedTextContent = document.getElementById('simplified-text-content');
const qaInput = document.getElementById('qa-input');
const askButton = document.getElementById('ask-button');
const qaAnswer = document.getElementById('qa-answer');
const clauseInput = document.getElementById('clause-input');
const compareButton = document.getElementById('compare-button');
const clauseComparison = document.getElementById('clause-comparison');

// --- Event Listeners ---
pdfUpload.addEventListener('change', handleFileSelect, false);
askButton.addEventListener('click', handleQuestionSubmit, false);
compareButton.addEventListener('click', handleClauseComparison, false);

// --- Main Functions ---

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        alert("Please select a PDF file.");
        return;
    }

    resultsContainer.style.display = 'none';
    qaAnswer.textContent = '';
    qaInput.value = '';
    clauseInput.value = '';
    clauseComparison.innerHTML = '';
    financialContent.innerHTML = '';
    keyPointsContent.innerHTML = '';
    risksContent.innerHTML = '';
    citationsContent.innerHTML = '';
    originalTextContent.textContent = '';
    simplifiedTextContent.textContent = '';
    
    showStatus('Reading your PDF...', 'processing');

    try {
        const fullText = await readPdfFile(file);
        documentTextForQA = fullText;
        originalTextContent.textContent = fullText;
        resultsContainer.style.display = 'block';
        
        showStatus('Analyzing with AI... This may take a moment.', 'processing');
        
        const aiResponse = await callGeminiAPI(fullText);
        const structuredResponse = JSON.parse(aiResponse);

        financialContent.innerHTML = structuredResponse.financialSummary;
        keyPointsContent.innerHTML = structuredResponse.keyIssues;
        risksContent.innerHTML = structuredResponse.loopholes;
        citationsContent.innerHTML = structuredResponse.legalCitations;
        simplifiedTextContent.textContent = structuredResponse.simplifiedText;

        showStatus('Your document has been analyzed! You can now ask questions or compare clauses.', 'success');
        
    } catch (error) {
        console.error("An error occurred:", error);
        showStatus(`Error: ${error.message}`, 'error');
        documentTextForQA = '';
    }
}

async function handleQuestionSubmit() {
    const userQuestion = qaInput.value.trim();
    if (!userQuestion || !documentTextForQA) {
        qaAnswer.textContent = 'Please upload a document and enter a question.';
        return;
    }
    qaAnswer.textContent = '🤔 Thinking...';
    askButton.disabled = true;
    try {
        const answer = await getAnswerFromAI(documentTextForQA, userQuestion);
        qaAnswer.textContent = answer;
    } catch (error) {
        qaAnswer.textContent = "Sorry, I couldn't get an answer. Please try again.";
    } finally {
        askButton.disabled = false;
    }
}

async function handleClauseComparison() {
    const clauseText = clauseInput.value.trim();
    if (!clauseText) {
        clauseComparison.textContent = 'Please paste a clause to compare.';
        return;
    }
    clauseComparison.innerHTML = '🤔 Analyzing and comparing...';
    compareButton.disabled = true;
    try {
        const comparison = await compareClauseWithAI(clauseText);
        clauseComparison.innerHTML = comparison;
    } catch (error) {
        clauseComparison.textContent = 'Sorry, an error occurred during comparison.';
    } finally {
        compareButton.disabled = false;
    }
}

// --- SECURE AI PROXY INTERACTION ---

async function callSecureAIProxy(prompt, action) {
  try {
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, action: action }),
    });

    if (!response.ok) {
      throw new Error(`Proxy request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Error calling secure proxy:", error);
    throw new Error("Could not get a response from the AI proxy.");
  }
}

// --- AI Call Definitions ---

async function callGeminiAPI(text) {
    const prompt = `
    You are an AI legal and financial analyst with expertise in Indian law. Your task is to conduct a rigorous analysis of the following legal document and return a single, clean JSON object with the keys "keyIssues", "loopholes", "legalCitations", "simplifiedText", and "financialSummary".
    1.  **financialSummary**: Analyze all financial clauses (rent, deposit, maintenance, escalation). Calculate total rent for the first year, total rent over the entire lease term (including escalation), and the security deposit as a multiple of monthly rent. Format as an HTML unordered list (\`<ul>\`).
    2.  **keyIssues**: Identify the top 5-7 most critical clauses, obligations, and financial commitments. Format as an HTML unordered list (\`<ul>\`).
    3.  **loopholes**: Scrutinize for ambiguous language, potential loopholes, or unfavorable terms. Explain the potential negative outcome for each. Format as an HTML unordered list (\`<ul>\`).
    4.  **legalCitations**: Cite relevant sections of Indian Law (e.g., "Section 17 of The Indian Contract Act, 1872"). Explain the relevance. Format as an HTML unordered list (\`<ul>\`).
    5.  **simplifiedText**: Rewrite the entire document in simple, plain English.
    Here is the document text:
    ---
    ${text}
    ---
    `;
    return await callSecureAIProxy(prompt, 'analyze');
}

async function getAnswerFromAI(documentText, userQuestion) {
    const prompt = `
    Based *only* on the provided legal document text, answer the user's question concisely. If the answer is not in the document, state: "The answer to that question could not be found in the provided document."
    DOCUMENT TEXT:---${documentText}---
    USER'S QUESTION: "${userQuestion}"
    ANSWER:`;
    return await callSecureAIProxy(prompt, 'qa');
}

async function compareClauseWithAI(clauseText) {
    const prompt = `
    You are an AI legal expert specializing in Indian contract law. A user has provided this clause: "${clauseText}". Your task is to: 1. Analyze the clause for fairness and risks. 2. Rewrite it as a "standard, fair version". 3. Present your analysis in HTML. Start with an \`<h3>Analysis:\`</h3>, then an \`<h3>Suggested Fair Version:\`</h3> followed by the rewritten clause in a \`<blockquote>\`.`;
    return await callSecureAIProxy(prompt, 'compare');
}

// --- Utility Functions ---
async function readPdfFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const typedarray = new Uint8Array(event.target.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
                }
                resolve(fullText.trim());
            } catch (error) { reject(error); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.style.display = 'block';
}