<template>
  <div class="knowledge-editor">
    <h2 class="section-title">Knowledge Base</h2>
    <p class="section-description">
      Create and manage knowledge articles for self-service support. All articles are isolated to your company (Company ID: {{ companyId }}).
    </p>

    <!-- Success Message -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Create/Edit Article Form -->
    <div class="form-card">
      <h3 class="form-title">{{ editingArticle ? 'Edit Article' : 'Create New Article' }}</h3>
      <form @submit.prevent="handleSaveArticle" class="article-form">
        <div class="form-group">
          <label for="title" class="form-label">Title *</label>
          <input
            id="title"
            v-model="formData.title"
            type="text"
            class="form-input"
            placeholder="How to Setup VPN Connection"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="category" class="form-label">Category</label>
            <input
              id="category"
              v-model="formData.category"
              type="text"
              class="form-input"
              placeholder="VPN Setup, Software Installation, etc."
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label class="form-label">
              <input
                v-model="formData.is_published"
                type="checkbox"
                class="checkbox-input"
                :disabled="loading"
              />
              <span class="checkbox-label">Publish Article (visible to all users)</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="content" class="form-label">Content *</label>
          <textarea
            id="content"
            v-model="formData.content"
            class="form-textarea"
            rows="12"
            placeholder="Enter article content here..."
            required
            :disabled="loading"
          ></textarea>
        </div>

        <div class="form-actions">
          <button
            type="submit"
            class="submit-button"
            :disabled="loading || !isFormValid"
          >
            <span v-if="loading">{{ editingArticle ? 'Updating...' : 'Creating...' }}</span>
            <span v-else>{{ editingArticle ? 'Update Article' : 'Create Article' }}</span>
          </button>
          <button
            v-if="editingArticle"
            type="button"
            @click="cancelEdit"
            class="cancel-button"
            :disabled="loading"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>

    <!-- Articles Tabs -->
    <div class="articles-tabs">
      <button
        @click="articleView = 'published'"
        :class="['tab-button', { active: articleView === 'published' }]"
      >
        Published Articles
      </button>
      <button
        @click="articleView = 'drafts'"
        :class="['tab-button', { active: articleView === 'drafts' }]"
      >
        Draft Articles
      </button>
    </div>

    <!-- Published Articles -->
    <div v-if="articleView === 'published'" class="articles-list-card">
      <div class="list-header">
        <h3 class="form-title">Published Articles</h3>
        <button @click="loadPublishedArticles" class="refresh-button" :disabled="loadingPublished">
          <span v-if="loadingPublished">Refreshing...</span>
          <span v-else>Refresh</span>
        </button>
      </div>

      <div v-if="loadingPublished" class="loading-state">
        Loading published articles...
      </div>

      <div v-else-if="publishedArticles.length === 0" class="empty-state">
        No published articles found.
      </div>

      <div v-else class="articles-list">
        <div
          v-for="article in publishedArticles"
          :key="article.id"
          class="article-card"
        >
          <div class="article-header">
            <h4 class="article-title">{{ article.title }}</h4>
            <span v-if="article.category" class="article-category">{{ article.category }}</span>
          </div>
          <p class="article-content-preview">{{ truncateContent(article.content) }}</p>
          <div class="article-footer">
            <span class="article-meta">
              By {{ article.users?.email || 'Unknown' }} • {{ formatDate(article.created_at) }}
            </span>
            <button @click="editArticle(article)" class="edit-button">Edit</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Draft Articles -->
    <div v-if="articleView === 'drafts'" class="articles-list-card">
      <div class="list-header">
        <h3 class="form-title">Draft Articles</h3>
        <button @click="loadDraftArticles" class="refresh-button" :disabled="loadingDrafts">
          <span v-if="loadingDrafts">Refreshing...</span>
          <span v-else>Refresh</span>
        </button>
      </div>

      <div v-if="loadingDrafts" class="loading-state">
        Loading draft articles...
      </div>

      <div v-else-if="draftArticles.length === 0" class="empty-state">
        No draft articles found.
      </div>

      <div v-else class="articles-list">
        <div
          v-for="article in draftArticles"
          :key="article.id"
          class="article-card draft"
        >
          <div class="article-header">
            <h4 class="article-title">{{ article.title }}</h4>
            <span class="draft-badge">Draft</span>
          </div>
          <p class="article-content-preview">{{ truncateContent(article.content) }}</p>
          <div class="article-footer">
            <span class="article-meta">
              By {{ article.users?.email || 'Unknown' }} • {{ formatDate(article.created_at) }}
            </span>
            <div class="article-actions">
              <button @click="editArticle(article)" class="edit-button">Edit</button>
              <button @click="publishArticle(article.id)" class="publish-button">Publish</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { createArticle, getPublishedArticles, getDraftArticles, updateArticle } from '../../services/itService'

const formData = ref({
  title: '',
  content: '',
  category: '',
  is_published: false
})

const loading = ref(false)
const loadingPublished = ref(false)
const loadingDrafts = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const publishedArticles = ref([])
const draftArticles = ref([])
const companyId = ref(null)
const editingArticle = ref(null)
const articleView = ref('published')

// Get company ID from current user session
onMounted(() => {
  const userData = localStorage.getItem('user_data')
  if (userData) {
    try {
      const user = JSON.parse(userData)
      companyId.value = user.company_id
    } catch (error) {
      console.error('Error parsing user data:', error)
    }
  }
  
  loadPublishedArticles()
  loadDraftArticles()
})

// Form validation
const isFormValid = computed(() => {
  return formData.value.title &&
         formData.value.content
})

/**
 * Load published articles
 */
async function loadPublishedArticles() {
  loadingPublished.value = true
  errorMessage.value = ''
  
  try {
    const result = await getPublishedArticles()
    
    if (result.success) {
      publishedArticles.value = result.articles || []
    } else {
      errorMessage.value = result.error || 'Failed to load published articles'
    }
  } catch (error) {
    console.error('Error loading published articles:', error)
    errorMessage.value = 'An unexpected error occurred while loading articles'
  } finally {
    loadingPublished.value = false
  }
}

/**
 * Load draft articles
 */
async function loadDraftArticles() {
  loadingDrafts.value = true
  errorMessage.value = ''
  
  try {
    const result = await getDraftArticles()
    
    if (result.success) {
      draftArticles.value = result.articles || []
    } else {
      errorMessage.value = result.error || 'Failed to load draft articles'
    }
  } catch (error) {
    console.error('Error loading draft articles:', error)
    errorMessage.value = 'An unexpected error occurred while loading drafts'
  } finally {
    loadingDrafts.value = false
  }
}

/**
 * Handle form submission to create or update article
 */
async function handleSaveArticle() {
  errorMessage.value = ''
  successMessage.value = ''
  loading.value = true

  try {
    if (!isFormValid.value) {
      errorMessage.value = 'Please fill in all required fields'
      loading.value = false
      return
    }

    let result
    if (editingArticle.value) {
      // Update existing article
      result = await updateArticle(editingArticle.value.id, formData.value)
    } else {
      // Create new article
      result = await createArticle(formData.value)
    }

    if (result.success) {
      successMessage.value = editingArticle.value
        ? 'Article updated successfully!'
        : 'Article created successfully!'
      
      // Reset form
      resetForm()
      
      // Reload articles
      await loadPublishedArticles()
      await loadDraftArticles()
      
      // Switch to appropriate view
      if (formData.value.is_published) {
        articleView.value = 'published'
      } else {
        articleView.value = 'drafts'
      }
    } else {
      errorMessage.value = result.error || 'Failed to save article'
    }
  } catch (error) {
    console.error('Error saving article:', error)
    errorMessage.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}

/**
 * Edit an article
 */
function editArticle(article) {
  editingArticle.value = article
  formData.value = {
    title: article.title,
    content: article.content,
    category: article.category || '',
    is_published: article.is_published || false
  }
  
  // Switch to appropriate view
  if (article.is_published) {
    articleView.value = 'published'
  } else {
    articleView.value = 'drafts'
  }
  
  // Scroll to form
  document.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth' })
}

/**
 * Publish a draft article
 */
async function publishArticle(articleId) {
  try {
    const result = await updateArticle(articleId, { is_published: true })
    
    if (result.success) {
      successMessage.value = 'Article published successfully!'
      await loadPublishedArticles()
      await loadDraftArticles()
      articleView.value = 'published'
    } else {
      errorMessage.value = result.error || 'Failed to publish article'
    }
  } catch (error) {
    console.error('Error publishing article:', error)
    errorMessage.value = 'An unexpected error occurred while publishing article'
  }
}

/**
 * Cancel editing
 */
function cancelEdit() {
  editingArticle.value = null
  resetForm()
}

/**
 * Reset form
 */
function resetForm() {
  formData.value = {
    title: '',
    content: '',
    category: '',
    is_published: false
  }
  editingArticle.value = null
}

/**
 * Truncate content for preview
 */
function truncateContent(content) {
  if (!content) return ''
  return content.length > 150 ? content.substring(0, 150) + '...' : content
}

/**
 * Format date for display
 */
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
.knowledge-editor {
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 8px;
}

.section-description {
  color: #718096;
  margin-bottom: 30px;
  line-height: 1.6;
}

.form-card,
.articles-list-card {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
}

.form-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 20px;
}

.article-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
}

.form-input,
.form-textarea {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s;
  background: white;
  font-family: inherit;
}

.form-textarea {
  resize: vertical;
  min-height: 200px;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.form-input:disabled,
.form-textarea:disabled {
  background: #f7fafc;
  cursor: not-allowed;
  opacity: 0.6;
}

.checkbox-input {
  margin-right: 8px;
}

.checkbox-label {
  font-size: 14px;
  color: #4a5568;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.submit-button {
  padding: 14px 24px;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-button:hover:not(:disabled) {
  background: #3182ce;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 153, 225, 0.4);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-button {
  padding: 14px 24px;
  background: #e2e8f0;
  color: #4a5568;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.cancel-button:hover:not(:disabled) {
  background: #cbd5e0;
}

.success-message {
  padding: 12px 16px;
  background: #c6f6d5;
  border: 1px solid #68d391;
  border-radius: 8px;
  color: #22543d;
  font-size: 14px;
  margin-bottom: 20px;
}

.error-message {
  padding: 12px 16px;
  background: #fed7d7;
  border: 1px solid #fc8181;
  border-radius: 8px;
  color: #c53030;
  font-size: 14px;
  margin-bottom: 20px;
}

.articles-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  background: white;
  padding: 10px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.tab-button {
  flex: 1;
  padding: 12px 24px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #718096;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-button:hover {
  background: #f7fafc;
  color: #4299e1;
}

.tab-button.active {
  background: #4299e1;
  color: white;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.refresh-button {
  padding: 8px 16px;
  background: #edf2f7;
  color: #4a5568;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.refresh-button:hover:not(:disabled) {
  background: #e2e8f0;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #718096;
}

.articles-list {
  display: grid;
  gap: 20px;
}

.article-card {
  background: #f7fafc;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.article-card.draft {
  border-left: 4px solid #ed8936;
}

.article-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.article-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
}

.article-category {
  padding: 4px 12px;
  background: #bee3f8;
  color: #2c5282;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.draft-badge {
  padding: 4px 12px;
  background: #fed7aa;
  color: #c05621;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.article-content-preview {
  color: #4a5568;
  line-height: 1.6;
  margin-bottom: 12px;
}

.article-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.article-meta {
  font-size: 12px;
  color: #718096;
}

.article-actions {
  display: flex;
  gap: 8px;
}

.edit-button,
.publish-button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.edit-button {
  background: #4299e1;
  color: white;
}

.edit-button:hover {
  background: #3182ce;
}

.publish-button {
  background: #48bb78;
  color: white;
}

.publish-button:hover {
  background: #38a169;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .list-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }

  .article-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .article-footer {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}
</style>


