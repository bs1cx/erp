<template>
  <div class="performance-management">
    <div class="section-header">
      <h2 class="section-title">Performance Reviews</h2>
      <button @click="openSubmitReviewModal" class="add-button">
        + Submit Review
      </button>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Performance Reviews List -->
    <div v-if="loading" class="loading-state">
      Loading performance reviews...
    </div>

    <div v-else-if="reviews.length === 0" class="empty-state">
      No performance reviews found. Submit your first review above.
    </div>

    <div v-else class="reviews-list">
      <div
        v-for="review in reviews"
        :key="review.id"
        class="review-card"
      >
        <div class="review-header">
          <div class="review-info">
            <div class="review-employee">{{ review.employee?.email }}</div>
            <div class="review-meta">
              <span class="review-date">{{ formatDate(review.review_date) }}</span>
              <span class="review-rating" :class="getRatingClass(review.rating)">
                ⭐ {{ review.rating }}/5
              </span>
            </div>
          </div>
          <div class="reviewer-info">
            Reviewed by: {{ review.reviewer?.email }}
          </div>
        </div>
        <div class="review-content">
          <div class="review-section">
            <strong>Summary:</strong>
            <p>{{ review.summary }}</p>
          </div>
          <div v-if="review.goals" class="review-section">
            <strong>Goals:</strong>
            <p>{{ review.goals }}</p>
          </div>
          <div v-if="review.achievements" class="review-section">
            <strong>Achievements:</strong>
            <p>{{ review.achievements }}</p>
          </div>
          <div v-if="review.areas_for_improvement" class="review-section">
            <strong>Areas for Improvement:</strong>
            <p>{{ review.areas_for_improvement }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Submit Review Modal -->
    <div v-if="showSubmitModal" class="modal-overlay" @click="closeSubmitModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Submit Performance Review</h3>
          <button @click="closeSubmitModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleSubmitReview" class="review-form">
          <div class="form-group">
            <label for="review-employee" class="form-label">Employee Email *</label>
            <select
              id="review-employee"
              v-model="reviewForm.employee_user_id"
              class="form-select"
              required
              :disabled="loadingSubmit || loadingEmployees"
            >
              <option value="">Select employee</option>
              <option
                v-for="employee in employees"
                :key="employee.id"
                :value="employee.id"
              >
                {{ employee.email }}
                <span v-if="employee.job_titles"> - {{ employee.job_titles.title_name }}</span>
              </option>
            </select>
            <small v-if="loadingEmployees" class="form-hint">Loading employees...</small>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="review-date" class="form-label">Review Date *</label>
              <input
                id="review-date"
                v-model="reviewForm.review_date"
                type="date"
                class="form-input"
                required
                :disabled="loadingSubmit"
                :max="maxDate"
              />
            </div>

            <div class="form-group">
              <label for="review-rating" class="form-label">Rating (1-5) *</label>
              <select
                id="review-rating"
                v-model="reviewForm.rating"
                class="form-select"
                required
                :disabled="loadingSubmit"
              >
                <option value="">Select rating</option>
                <option value="1">1 - Needs Improvement</option>
                <option value="2">2 - Below Expectations</option>
                <option value="3">3 - Meets Expectations</option>
                <option value="4">4 - Exceeds Expectations</option>
                <option value="5">5 - Outstanding</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="review-summary" class="form-label">Summary *</label>
            <textarea
              id="review-summary"
              v-model="reviewForm.summary"
              class="form-textarea"
              rows="4"
              placeholder="Overall performance summary..."
              required
              :disabled="loadingSubmit"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="review-goals" class="form-label">Goals</label>
            <textarea
              id="review-goals"
              v-model="reviewForm.goals"
              class="form-textarea"
              rows="3"
              placeholder="Future goals and objectives..."
              :disabled="loadingSubmit"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="review-achievements" class="form-label">Achievements</label>
            <textarea
              id="review-achievements"
              v-model="reviewForm.achievements"
              class="form-textarea"
              rows="3"
              placeholder="Key achievements and accomplishments..."
              :disabled="loadingSubmit"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="review-improvement" class="form-label">Areas for Improvement</label>
            <textarea
              id="review-improvement"
              v-model="reviewForm.areas_for_improvement"
              class="form-textarea"
              rows="3"
              placeholder="Areas that need improvement..."
              :disabled="loadingSubmit"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeSubmitModal" class="cancel-button" :disabled="loadingSubmit">
              Cancel
            </button>
            <button type="submit" class="submit-button" :disabled="loadingSubmit || !isReviewFormValid">
              <span v-if="loadingSubmit">Submitting...</span>
              <span v-else>Submit Review</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { submitPerformanceReview, getEmployeeReviewHistory, getAllCompanyEmployees } from '../../services/hrService'

const emit = defineEmits(['updated'])

const reviews = ref([])
const employees = ref([])
const loading = ref(false)
const loadingSubmit = ref(false)
const loadingEmployees = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showSubmitModal = ref(false)
const reviewForm = ref({
  employee_user_id: '',
  review_date: '',
  rating: '',
  summary: '',
  goals: '',
  achievements: '',
  areas_for_improvement: ''
})

const maxDate = computed(() => {
  return new Date().toISOString().split('T')[0]
})

const isReviewFormValid = computed(() => {
  return reviewForm.value.employee_user_id &&
         reviewForm.value.review_date &&
         reviewForm.value.rating &&
         reviewForm.value.summary
})

onMounted(() => {
  loadEmployees()
  loadAllReviews()
})

async function loadEmployees() {
  loadingEmployees.value = true
  try {
    const result = await getAllCompanyEmployees()
    if (result.success) {
      employees.value = result.employees || []
    }
  } catch (error) {
    console.error('Error loading employees:', error)
  } finally {
    loadingEmployees.value = false
  }
}

async function loadAllReviews() {
  loading.value = true
  errorMessage.value = ''
  
  try {
    // Load reviews for all employees (we'll need to aggregate)
    // For now, let's get reviews for the first employee as a placeholder
    // In a full implementation, you'd want a getAllReviews function
    if (employees.value.length > 0) {
      const result = await getEmployeeReviewHistory(employees.value[0].id)
      if (result.success) {
        reviews.value = result.reviews || []
      }
    }
  } catch (error) {
    console.error('Error loading reviews:', error)
    errorMessage.value = 'Failed to load performance reviews'
  } finally {
    loading.value = false
  }
}

function openSubmitReviewModal() {
  reviewForm.value = {
    employee_user_id: '',
    review_date: new Date().toISOString().split('T')[0],
    rating: '',
    summary: '',
    goals: '',
    achievements: '',
    areas_for_improvement: ''
  }
  showSubmitModal.value = true
}

function closeSubmitModal() {
  showSubmitModal.value = false
  reviewForm.value = {
    employee_user_id: '',
    review_date: '',
    rating: '',
    summary: '',
    goals: '',
    achievements: '',
    areas_for_improvement: ''
  }
}

async function handleSubmitReview() {
  loadingSubmit.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await submitPerformanceReview(reviewForm.value)
    if (result.success) {
      successMessage.value = 'Performance review submitted successfully!'
      closeSubmitModal()
      await loadAllReviews()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to submit review'
    }
  } catch (error) {
    console.error('Error submitting review:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loadingSubmit.value = false
  }
}

function getRatingClass(rating) {
  if (rating >= 4) return 'rating-high'
  if (rating >= 3) return 'rating-medium'
  return 'rating-low'
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
.performance-management {
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

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.review-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  transition: all var(--transition-base);
}

.review-card:hover {
  box-shadow: 0 2px 8px var(--color-shadow);
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.review-info {
  flex: 1;
}

.review-employee {
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-xs);
}

.review-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.review-rating {
  font-weight: 600;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.rating-high {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.rating-medium {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.rating-low {
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
}

.reviewer-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
}

.review-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.review-section {
  color: var(--color-text-dark);
}

.review-section strong {
  display: block;
  margin-bottom: var(--spacing-xs);
  color: var(--color-text-dark);
}

.review-section p {
  margin: 0;
  color: var(--color-text-medium);
  line-height: 1.6;
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
  max-width: 700px;
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

.review-form {
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

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
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

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>


