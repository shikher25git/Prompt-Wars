import { initGemini, isInitialized, parseDocuments } from './gemini.js';

// ===== DOM Elements =====
const settingsToggle = document.getElementById('settings-toggle');
const apiPanel = document.getElementById('api-panel');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeySave = document.getElementById('api-key-save');
const apiStatus = document.getElementById('api-status');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const voiceBtn = document.getElementById('voice-btn');
const voiceStatus = document.getElementById('voice-status');
const voiceTranscript = document.getElementById('voice-transcript');
const textInput = document.getElementById('text-input');
const processBtn = document.getElementById('process-btn');
const inputSection = document.getElementById('input-section');
const loadingSection = document.getElementById('loading-section');
const loadingStatus = document.getElementById('loading-status');
const resultsSection = document.getElementById('results-section');
const resetBtn = document.getElementById('reset-btn');

// ===== State =====
let uploadedFiles = [];
let transcript = '';
let recognition = null;

// ===== API Key Management =====
function loadApiKey() {
  const saved = localStorage.getItem('medstack_api_key');
  if (saved) {
    apiKeyInput.value = saved;
    initGemini(saved);
    updateProcessButton();
  }
}

settingsToggle.addEventListener('click', () => {
  apiPanel.classList.toggle('hidden');
});

apiKeySave.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showApiStatus('Please enter an API key.', 'error');
    return;
  }
  localStorage.setItem('medstack_api_key', key);
  initGemini(key);
  showApiStatus('✓ API key saved and ready!', 'success');
  updateProcessButton();
  setTimeout(() => apiPanel.classList.add('hidden'), 3000);
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') apiKeySave.click();
});

function showApiStatus(msg, type) {
  apiStatus.textContent = msg;
  apiStatus.className = 'api-status ' + type;
}

// ===== File Upload =====
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInput.value = '';
});

function handleFiles(fileList) {
  for (const file of fileList) {
    if (!uploadedFiles.some((f) => f.name === file.name && f.size === file.size)) {
      uploadedFiles.push(file);
    }
  }
  renderFilePreviews();
  updateProcessButton();
}

function renderFilePreviews() {
  if (uploadedFiles.length === 0) {
    filePreview.classList.add('hidden');
    return;
  }

  filePreview.classList.remove('hidden');
  filePreview.innerHTML = '';

  uploadedFiles.forEach((file, idx) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';

    if (file.type.startsWith('image/')) {
      const thumb = document.createElement('img');
      thumb.className = 'file-thumb';
      thumb.src = URL.createObjectURL(file);
      thumb.alt = file.name;
      chip.appendChild(thumb);
    }

    const name = document.createElement('span');
    name.textContent = file.name.length > 25 ? file.name.substring(0, 22) + '...' : file.name;
    chip.appendChild(name);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-file';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove file';
    removeBtn.addEventListener('click', () => {
      uploadedFiles.splice(idx, 1);
      renderFilePreviews();
      updateProcessButton();
    });
    chip.appendChild(removeBtn);

    filePreview.appendChild(chip);
  });
}

// ===== Voice Input =====
function setupVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    voiceBtn.title = 'Voice input not supported in this browser';
    voiceBtn.style.opacity = '0.3';
    voiceBtn.style.cursor = 'not-allowed';
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let final = '';
    let interim = '';
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    transcript = final || interim;
    voiceTranscript.classList.remove('hidden');
    voiceTranscript.textContent = `"${transcript}"`;
    updateProcessButton();
  };

  recognition.onend = () => {
    voiceBtn.classList.remove('recording');
    voiceStatus.classList.add('hidden');
    voiceBtn.querySelector('span').textContent = 'Voice Input';
  };

  recognition.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    voiceBtn.classList.remove('recording');
    voiceStatus.classList.add('hidden');
  };
}

voiceBtn.addEventListener('click', () => {
  if (!recognition) return;

  if (voiceBtn.classList.contains('recording')) {
    recognition.stop();
  } else {
    transcript = '';
    voiceTranscript.classList.add('hidden');
    recognition.start();
    voiceBtn.classList.add('recording');
    voiceStatus.classList.remove('hidden');
    voiceBtn.querySelector('span').textContent = 'Stop Recording';
  }
});

// ===== Process Button State =====
function updateProcessButton() {
  const hasInput = uploadedFiles.length > 0 || textInput.value.trim() || transcript;
  const hasKey = isInitialized();
  processBtn.disabled = !(hasInput && hasKey);

  if (!hasKey) {
    processBtn.querySelector('span').textContent = 'Set API Key First';
  } else if (!hasInput) {
    processBtn.querySelector('span').textContent = 'Add Documents or Notes';
  } else {
    processBtn.querySelector('span').textContent = 'Analyze with Gemini';
  }
}

textInput.addEventListener('input', updateProcessButton);

// ===== Process Documents =====
processBtn.addEventListener('click', async () => {
  if (processBtn.disabled) return;

  // Show loading
  inputSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');

  try {
    const result = await parseDocuments(
      uploadedFiles,
      textInput.value.trim(),
      transcript,
      (status) => {
        loadingStatus.textContent = status;
      }
    );

    renderResults(result);
    loadingSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
  } catch (err) {
    console.error('Analysis failed:', err);
    loadingSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    showError(err.message);
  }
});

function showError(message) {
  // Remove any existing error
  const existing = document.querySelector('.error-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.innerHTML = `
    <span class="error-icon">❌</span>
    <div class="error-body">
      <strong>Analysis Failed</strong>
      <p>${message}</p>
    </div>
    <button class="error-dismiss" onclick="this.parentElement.remove()">×</button>
  `;
  inputSection.insertBefore(banner, inputSection.firstChild);
}

// ===== Reset =====
resetBtn.addEventListener('click', () => {
  resultsSection.classList.add('hidden');
  inputSection.classList.remove('hidden');
  uploadedFiles = [];
  transcript = '';
  textInput.value = '';
  voiceTranscript.classList.add('hidden');
  renderFilePreviews();
  updateProcessButton();
});

// ===== Render Results =====
function renderResults(data) {
  // Patient Info
  renderPatientInfo(data.patient);

  // Conditions
  renderConditions(data.conditions);

  // Medications
  renderMedications(data.medications);

  // Allergies
  renderAllergies(data.allergies);

  // Lab Results
  renderLabResults(data.labResults);

  // Procedures
  renderProcedures(data.procedures);

  // Drug Interactions (alerts)
  renderAlerts(data.drugInteractions);

  // ER Summary
  renderERSummary(data.erSummary);
}

function renderPatientInfo(patient) {
  const el = document.getElementById('patient-info');
  if (!patient) {
    el.innerHTML = '<p class="empty-state">No patient information found</p>';
    return;
  }

  const fields = [
    ['Name', patient.name],
    ['Age', patient.age],
    ['Sex', patient.sex],
    ['Blood Type', patient.bloodType],
    ['Weight', patient.weight],
    ['Height', patient.height],
    ['Emergency Contact', patient.emergencyContact],
  ];

  el.innerHTML = fields
    .filter(([, v]) => v && v !== 'Unknown')
    .map(([label, value]) => `
      <div class="data-row">
        <span class="data-label">${label}</span>
        <span class="data-value">${value}</span>
      </div>
    `)
    .join('');

  if (!el.innerHTML) {
    el.innerHTML = '<p class="empty-state">No patient demographics found</p>';
  }
}

function renderConditions(conditions) {
  const el = document.getElementById('conditions-list');
  if (!conditions || conditions.length === 0) {
    el.innerHTML = '<p class="empty-state">No conditions identified</p>';
    return;
  }

  el.innerHTML = conditions
    .map((c) => {
      const badgeClass = c.status === 'active' ? 'badge-active' : c.status === 'resolved' ? 'badge-resolved' : 'badge-active';
      return `
        <div class="condition-item">
          <div class="item-name">${c.name} <span class="item-badge ${badgeClass}">${c.status}</span></div>
          <div class="item-detail">${c.diagnosedDate !== 'Unknown' ? `Since ${c.diagnosedDate}` : ''}${c.notes ? ` • ${c.notes}` : ''}</div>
        </div>
      `;
    })
    .join('');
}

function renderMedications(meds) {
  const el = document.getElementById('medications-list');
  if (!meds || meds.length === 0) {
    el.innerHTML = '<p class="empty-state">No medications found</p>';
    return;
  }

  el.innerHTML = meds
    .map((m) => `
      <div class="med-item">
        <div class="item-name">${m.name}</div>
        <div class="item-detail">
          ${m.dosage || ''} ${m.frequency ? `• ${m.frequency}` : ''}
          ${m.purpose ? `• For: ${m.purpose}` : ''}
          ${m.prescribedBy && m.prescribedBy !== 'Unknown' ? `• By: ${m.prescribedBy}` : ''}
        </div>
      </div>
    `)
    .join('');
}

function renderAllergies(allergies) {
  const el = document.getElementById('allergies-list');
  if (!allergies || allergies.length === 0) {
    el.innerHTML = '<p class="empty-state">No allergies reported</p>';
    return;
  }

  el.innerHTML = allergies
    .map((a) => {
      const badgeClass = a.severity === 'severe' ? 'badge-severe' : a.severity === 'moderate' ? 'badge-moderate' : 'badge-mild';
      return `
        <div class="allergy-item">
          <div class="item-name">${a.allergen} <span class="item-badge ${badgeClass}">${a.severity}</span></div>
          <div class="item-detail">${a.reaction}</div>
        </div>
      `;
    })
    .join('');
}

function renderLabResults(labs) {
  const el = document.getElementById('labs-list');
  if (!labs || labs.length === 0) {
    el.innerHTML = '<p class="empty-state">No lab results found</p>';
    return;
  }

  el.innerHTML = `
    <table class="lab-table">
      <thead>
        <tr>
          <th>Test</th>
          <th>Value</th>
          <th>Normal Range</th>
          <th>Date</th>
          <th>Flag</th>
        </tr>
      </thead>
      <tbody>
        ${labs.map((l) => `
          <tr>
            <td>${l.test}</td>
            <td><strong>${l.value} ${l.unit || ''}</strong></td>
            <td>${l.normalRange || '—'}</td>
            <td>${l.date || '—'}</td>
            <td><span class="lab-flag ${l.flag}">${l.flag === 'high' ? '↑ High' : l.flag === 'low' ? '↓ Low' : '✓ Normal'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderProcedures(procedures) {
  const el = document.getElementById('procedures-list');
  if (!procedures || procedures.length === 0) {
    el.innerHTML = '<p class="empty-state">No procedures recorded</p>';
    return;
  }

  el.innerHTML = procedures
    .map((p) => `
      <div class="procedure-item">
        <div class="item-name">${p.name}</div>
        <div class="item-detail">
          ${p.date || 'Date unknown'}
          ${p.hospital && p.hospital !== 'Unknown' ? ` • ${p.hospital}` : ''}
          ${p.notes ? ` • ${p.notes}` : ''}
        </div>
      </div>
    `)
    .join('');
}

function renderAlerts(interactions) {
  const container = document.getElementById('alerts-container');
  if (!interactions || interactions.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = interactions
    .map((i) => {
      const isHigh = i.severity === 'high';
      return `
        <div class="alert-card ${isHigh ? 'danger' : 'warning'}">
          <span class="alert-icon">${isHigh ? '🚨' : '⚠️'}</span>
          <div class="alert-body">
            <h4>Drug Interaction: ${i.drug1} + ${i.drug2}</h4>
            <p>${i.description}</p>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderERSummary(summary) {
  const card = document.getElementById('er-summary');
  const content = document.getElementById('er-summary-content');

  if (!summary) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');
  content.innerHTML = summary.split('\n').map((line) => `<p>${line}</p>`).join('');
}

// ===== Init =====
loadApiKey();
setupVoice();
updateProcessButton();

// Auto-open API panel if no key
if (!isInitialized()) {
  setTimeout(() => apiPanel.classList.remove('hidden'), 500);
}
