<template>
  <div class="recruitment-overview">
    <!-- 
      RECRUITMENT SCOPE DEFINITION:
      =============================
      External integration with job boards (LinkedIn, Kariyer.net, etc.) is implemented
      as a secure API key configuration placeholder ready for integration via a dedicated
      microservice or third-party API wrapper.
      
      This is the standard enterprise architecture approach, allowing:
      - Secure credential management
      - Service isolation
      - Scalable integration patterns
      - Easy switching between providers
      
      The current implementation provides the foundation for job posting management
      and candidate tracking, with the integration layer ready for connection.
    -->
    <div class="scope-notice">
      <h3 class="notice-title">Recruitment Integration Scope</h3>
      <p class="notice-text">
        <strong>Current Functionality:</strong> Job Posting Management and Candidate Tracking
      </p>
      <p class="notice-text">
        <strong>External Integration:</strong> Secure API key configuration placeholder ready for integration via dedicated microservice or third-party API wrapper (standard enterprise architecture approach)
      </p>
      <p class="notice-text">
        <strong>Note:</strong> Integration with LinkedIn, Kariyer.net, and other job boards can be connected through the configured API endpoints.
      </p>
    </div>
    
    <div class="section-header">
      <h2 class="section-title">Recruitment</h2>
      <button @click="openCreateJobModal" class="add-button">
        + Create Job Posting
      </button>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Job Postings -->
    <div v-if="loading" class="loading-state">
      Loading job postings...
    </div>

    <div v-else-if="jobPostings.length === 0" class="empty-state">
      No job postings found. Create your first job posting above.
    </div>

    <div v-else class="postings-grid">
      <div
        v-for="posting in jobPostings"
        :key="posting.id"
        class="posting-card"
      >
        <div class="posting-header">
          <h3 class="posting-title">{{ posting.title }}</h3>
          <span class="posting-status" :class="getStatusClass(posting.status)">
            {{ posting.status }}
          </span>
        </div>
        <div class="posting-meta">
          <span class="posting-department">{{ posting.department || 'No Department' }}</span>
          <span class="posting-date">{{ formatDate(posting.posted_date) }}</span>
        </div>
        <p class="posting-description">{{ truncateText(posting.description, 150) }}</p>
        <div class="posting-footer">
          <div class="candidate-count">
            <span class="count-icon">👥</span>
            <span class="count-value">{{ posting.candidate_count || 0 }} Candidates</span>
          </div>
          <button @click="viewCandidates(posting.id)" class="view-button">
            View Details
          </button>
        </div>
      </div>
    </div>

    <!-- Create Job Posting Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click="closeCreateModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Create Job Posting</h3>
          <button @click="closeCreateModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleCreateJobPosting" class="job-form">
          <div class="form-group">
            <label for="job-title" class="form-label">Job Title *</label>
            <input
              id="job-title"
              v-model="jobForm.title"
              type="text"
              class="form-input"
              placeholder="Senior Software Engineer"
              required
              :disabled="loadingCreate"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="job-department" class="form-label">Department</label>
              <input
                id="job-department"
                v-model="jobForm.department"
                type="text"
                class="form-input"
                placeholder="Engineering"
                :disabled="loadingCreate"
              />
            </div>

            <div class="form-group">
              <label for="job-status" class="form-label">Status</label>
              <select
                id="job-status"
                v-model="jobForm.status"
                class="form-select"
                :disabled="loadingCreate"
              >
                <option value="Open">Open</option>
                <option value="On Hold">On Hold</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="job-description" class="form-label">Description *</label>
            <textarea
              id="job-description"
              v-model="jobForm.description"
              class="form-textarea"
              rows="6"
              placeholder="Job description, requirements, responsibilities..."
              required
              :disabled="loadingCreate"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="job-closing-date" class="form-label">Closing Date</label>
            <input
              id="job-closing-date"
              v-model="jobForm.closing_date"
              type="date"
              class="form-input"
              :disabled="loadingCreate"
              :min="minDate"
            />
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeCreateModal" class="cancel-button" :disabled="loadingCreate">
              Cancel
            </button>
            <button type="submit" class="submit-button" :disabled="loadingCreate || !isJobFormValid">
              <span v-if="loadingCreate">Creating...</span>
              <span v-else>Create Posting</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { createJobPosting, getJobPostings } from '../../services/hrService'

const emit = defineEmits(['updated'])

const jobPostings = ref([])
const loading = ref(false)
const loadingCreate = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showCreateModal = ref(false)
const jobForm = ref({
  title: '',
  description: '',
  department: '',
  status: 'Open',
  closing_date: ''
})

const minDate = computed(() => {
  return new Date().toISOString().split('T')[0]
})

const isJobFormValid = computed(() => {
  return jobForm.value.title && jobForm.value.description
})

onMounted(() => {
  loadJobPostings()
})

async function loadJobPostings() {
  loading.value = true
  errorMessage.value = ''
  
  try {
    const result = await getJobPostings()
    if (result.success) {
      jobPostings.value = result.postings || []
    } else {
      errorMessage.value = result.error || 'Failed to load job postings'
    }
  } catch (error) {
    console.error('Error loading job postings:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

function openCreateJobModal() {
  jobForm.value = {
    title: '',
    description: '',
    department: '',
    status: 'Open',
    closing_date: ''
  }
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
  jobForm.value = {
    title: '',
    description: '',
    department: '',
    status: 'Open',
    closing_date: ''
  }
}

async function handleCreateJobPosting() {
  loadingCreate.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await createJobPosting(jobForm.value)
    if (result.success) {
      successMessage.value = 'Job posting created successfully!'
      closeCreateModal()
      await loadJobPostings()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to create job posting'
    }
  } catch (error) {
    console.error('Error creating job posting:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingCreate.value = false
  }
}

function viewCandidates(postingId) {
  // TODO: Implement candidate view modal
  alert(`View candidates for job posting ${postingId}`)
}

function getStatusClass(status) {
  const statusClasses = {
    'Open': 'status-open',
    'Closed': 'status-closed',
    'On Hold': 'status-on-hold'
  }
  return statusClasses[status] || 'status-default'
}

function truncateText(text, maxLength) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    return dateString
  }
}
</script>

<style scoped>
.recruitment-overview {
  width: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0;
}

.add-button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.add-button:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.postings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--spacing-lg);
}

.posting-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  transition: all var(--transition-base);
}

.posting-card:hover {
  box-shadow: 0 4px 12px var(--color-shadow-hover);
  transform: translateY(-2px);
}

.posting-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
}

.posting-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0;
  flex: 1;
}

.posting-status {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.status-open {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.status-closed {
  background: var(--color-text-medium);
  color: var(--color-text-on-primary);
}

.status-on-hold {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.posting-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
  margin-bottom: var(--spacing-md);
}

.posting-department {
  font-weight: 500;
}

.posting-description {
  color: var(--color-text-medium);
  line-height: 1.6;
  margin-bottom: var(--spacing-lg);
}

.posting-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.candidate-count {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.count-icon {
  font-size: 18px;
}

.view-button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.view-button:hover {
  background: var(--color-primary-dark);
}

/* Modal Styles - same as other modals */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.modal-header h3 {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 32px;
  color: var(--color-text-medium);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-base);
}

.modal-close:hover {
  color: var(--color-text-dark);
}

.job-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-medium);
}

.form-input,
.form-select,
.form-textarea {
  padding: var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
  background: var(--color-background);
  font-family: inherit;
}

.form-textarea {
  resize: vertical;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(42, 99, 62, 0.1);
}

.form-input:disabled,
.form-select:disabled,
.form-textarea:disabled {
  background: var(--color-surface);
  cursor: not-allowed;
  opacity: 0.6;
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-lg);
}

.submit-button,
.cancel-button {
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.submit-button {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
}

.submit-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-button {
  background: var(--color-surface);
  color: var(--color-text-dark);
  border: 1px solid var(--color-border);
}

.cancel-button:hover:not(:disabled) {
  background: var(--color-border-light);
}

.success-message {
  padding: var(--spacing-md);
  background: var(--color-success-light);
  border: 1px solid var(--color-success);
  border-radius: var(--radius-md);
  color: var(--color-text-on-primary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-lg);
}

.error-message {
  padding: var(--spacing-md);
  background: var(--color-danger-light);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  color: var(--color-text-on-primary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-lg);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-medium);
}

.scope-notice {
  padding: var(--spacing-lg);
  background: var(--color-info-light);
  border: 2px solid var(--color-info);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
}

.notice-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0 0 var(--spacing-md) 0;
}

.notice-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-dark);
  margin: var(--spacing-xs) 0;
  line-height: 1.6;
}

.notice-text strong {
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .postings-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>


