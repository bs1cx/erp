<template>
  <div class="asset-management">
    <h2 class="section-title">Asset Inventory (CMDB)</h2>
    <p class="section-description">
      Manage IT assets for your company. All assets are isolated to your company (Company ID: {{ companyId }}).
    </p>

    <!-- Success Message -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Create/Edit Asset Form -->
    <div class="form-card">
      <h3 class="form-title">{{ editingAsset ? 'Edit Asset' : 'Add New Asset' }}</h3>
      <form @submit.prevent="handleSaveAsset" class="asset-form">
        <div class="form-row">
          <div class="form-group">
            <label for="asset_tag" class="form-label">Asset Tag *</label>
            <input
              id="asset_tag"
              v-model="formData.asset_tag"
              type="text"
              class="form-input"
              placeholder="ASSET-001"
              required
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="name" class="form-label">Asset Name *</label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              class="form-input"
              placeholder="Dell Latitude 7420"
              required
              :disabled="loading"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="type" class="form-label">Asset Type *</label>
            <select
              id="type"
              v-model="formData.type"
              class="form-select"
              required
              :disabled="loading"
            >
              <option value="">Select type</option>
              <option value="Laptop">Laptop</option>
              <option value="Desktop">Desktop</option>
              <option value="Monitor">Monitor</option>
              <option value="Printer">Printer</option>
              <option value="Server">Server</option>
              <option value="Network Equipment">Network Equipment</option>
              <option value="Software License">Software License</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label for="status" class="form-label">Status *</label>
            <select
              id="status"
              v-model="formData.status"
              class="form-select"
              required
              :disabled="loading"
            >
              <option value="Stock">Stock</option>
              <option value="In Use">In Use</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Retired">Retired</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="purchase_date" class="form-label">Purchase Date</label>
            <input
              id="purchase_date"
              v-model="formData.purchase_date"
              type="date"
              class="form-input"
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="warranty_end_date" class="form-label">Warranty End Date</label>
            <input
              id="warranty_end_date"
              v-model="formData.warranty_end_date"
              type="date"
              class="form-input"
              :disabled="loading"
            />
          </div>
        </div>

        <div class="form-actions">
          <button
            type="submit"
            class="submit-button"
            :disabled="loading || !isFormValid"
          >
            <span v-if="loading">{{ editingAsset ? 'Updating...' : 'Creating...' }}</span>
            <span v-else>{{ editingAsset ? 'Update Asset' : 'Create Asset' }}</span>
          </button>
          <button
            v-if="editingAsset"
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

    <!-- Assets List -->
    <div class="assets-list-card">
      <div class="list-header">
        <h3 class="form-title">Company Assets</h3>
        <button @click="loadAssets" class="refresh-button" :disabled="loadingAssets">
          <span v-if="loadingAssets">Refreshing...</span>
          <span v-else>Refresh</span>
        </button>
      </div>

      <div v-if="loadingAssets" class="loading-state">
        Loading assets...
      </div>

      <div v-else-if="assets.length === 0" class="empty-state">
        No assets found. Create your first asset above.
      </div>

      <div v-else class="assets-table">
        <table>
          <thead>
            <tr>
              <th>Asset Tag</th>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Purchase Date</th>
              <th>Warranty End</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="asset in assets" :key="asset.id">
              <td>{{ asset.asset_tag }}</td>
              <td>{{ asset.name }}</td>
              <td>{{ asset.type }}</td>
              <td>
                <span class="status-badge" :class="getStatusClass(asset.status)">
                  {{ asset.status }}
                </span>
              </td>
              <td>
                <div class="assignment-cell">
                  <span v-if="asset.users?.email" class="assigned-user">
                    {{ asset.users.email }}
                  </span>
                  <span v-else class="unassigned">Unassigned</span>
                  <button @click="openAssignmentModal(asset)" class="assign-button" title="Assign/Unassign">
                    {{ asset.users?.email ? 'Change' : 'Assign' }}
                  </button>
                </div>
              </td>
              <td>{{ formatDate(asset.purchase_date) }}</td>
              <td>
                <span :class="{ 'warranty-expired': isWarrantyExpired(asset.warranty_end_date) }">
                  {{ formatDate(asset.warranty_end_date) }}
                </span>
              </td>
              <td>
                <button @click="editAsset(asset)" class="edit-button">Edit</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Assignment Modal -->
    <div v-if="showAssignmentModal" class="modal-overlay" @click="closeAssignmentModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Assign Asset: {{ assignmentAsset?.asset_tag }}</h3>
          <button @click="closeAssignmentModal" class="modal-close">×</button>
        </div>

        <div class="assignment-form">
          <div class="form-group">
            <label for="assign-user" class="form-label">Assign To User</label>
            <select
              id="assign-user"
              v-model="selectedUserId"
              class="form-select"
              :disabled="loadingAssignment"
            >
              <option :value="null">Unassigned</option>
              <option
                v-for="user in companyUsers"
                :key="user.id"
                :value="user.id"
              >
                {{ user.email }}
                <span v-if="user.job_titles"> - {{ user.job_titles.title_name }}</span>
              </option>
            </select>
            <small v-if="loadingUsers" class="form-hint">Loading users...</small>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              @click="closeAssignmentModal"
              class="cancel-button"
              :disabled="loadingAssignment"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleAssignAsset"
              class="submit-button"
              :disabled="loadingAssignment"
            >
              <span v-if="loadingAssignment">Assigning...</span>
              <span v-else>{{ selectedUserId ? 'Assign' : 'Unassign' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { createAsset, getCompanyAssets, updateAsset, assignAsset, getAllCompanyUsers } from '../../services/itService'

const formData = ref({
  asset_tag: '',
  name: '',
  type: '',
  status: 'Stock',
  purchase_date: '',
  warranty_end_date: ''
})

const loading = ref(false)
const loadingAssets = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const assets = ref([])
const companyId = ref(null)
const editingAsset = ref(null)
const showAssignmentModal = ref(false)
const assignmentAsset = ref(null)
const selectedUserId = ref(null)
const loadingAssignment = ref(false)
const loadingUsers = ref(false)
const companyUsers = ref([])

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
  
  loadAssets()
  loadCompanyUsers()
})

// Form validation
const isFormValid = computed(() => {
  return formData.value.asset_tag &&
         formData.value.name &&
         formData.value.type &&
         formData.value.status
})

/**
 * Load assets for the current company
 */
async function loadAssets() {
  loadingAssets.value = true
  errorMessage.value = ''
  
  try {
    const result = await getCompanyAssets()
    
    if (result.success) {
      assets.value = result.assets || []
    } else {
      errorMessage.value = result.error || 'Failed to load assets'
    }
  } catch (error) {
    console.error('Error loading assets:', error)
    errorMessage.value = 'An unexpected error occurred while loading assets'
  } finally {
    loadingAssets.value = false
  }
}

/**
 * Handle form submission to create or update asset
 */
async function handleSaveAsset() {
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
    if (editingAsset.value) {
      // Update existing asset
      result = await updateAsset(editingAsset.value.id, formData.value)
    } else {
      // Create new asset
      result = await createAsset(formData.value)
    }

    if (result.success) {
      successMessage.value = editingAsset.value
        ? 'Asset updated successfully!'
        : 'Asset created successfully!'
      
      // Reset form
      resetForm()
      
      // Reload assets list
      await loadAssets()
    } else {
      errorMessage.value = result.error || 'Failed to save asset'
    }
  } catch (error) {
    console.error('Error saving asset:', error)
    errorMessage.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}

/**
 * Edit an asset
 */
function editAsset(asset) {
  editingAsset.value = asset
  formData.value = {
    asset_tag: asset.asset_tag,
    name: asset.name,
    type: asset.type,
    status: asset.status,
    purchase_date: asset.purchase_date || '',
    warranty_end_date: asset.warranty_end_date || ''
  }
  
  // Scroll to form
  document.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth' })
}

/**
 * Cancel editing
 */
function cancelEdit() {
  editingAsset.value = null
  resetForm()
}

/**
 * Reset form
 */
function resetForm() {
  formData.value = {
    asset_tag: '',
    name: '',
    type: '',
    status: 'Stock',
    purchase_date: '',
    warranty_end_date: ''
  }
  editingAsset.value = null
}

/**
 * Get CSS class for status badge
 */
function getStatusClass(status) {
  const statusClasses = {
    'In Use': 'status-in-use',
    'Stock': 'status-stock',
    'Maintenance': 'status-maintenance',
    'Retired': 'status-retired'
  }
  return statusClasses[status] || 'status-default'
}

/**
 * Check if warranty is expired
 */
function isWarrantyExpired(warrantyEndDate) {
  if (!warrantyEndDate) return false
  return new Date(warrantyEndDate) < new Date()
}

/**
 * Load company users for assignment dropdown
 */
async function loadCompanyUsers() {
  loadingUsers.value = true
  try {
    const result = await getAllCompanyUsers()
    if (result.success) {
      companyUsers.value = result.users || []
    }
  } catch (error) {
    console.error('Error loading company users:', error)
  } finally {
    loadingUsers.value = false
  }
}

/**
 * Open assignment modal for an asset
 */
function openAssignmentModal(asset) {
  assignmentAsset.value = asset
  selectedUserId.value = asset.assigned_to_user_id || null
  showAssignmentModal.value = true
}

/**
 * Close assignment modal
 */
function closeAssignmentModal() {
  showAssignmentModal.value = false
  assignmentAsset.value = null
  selectedUserId.value = null
}

/**
 * Handle asset assignment
 */
async function handleAssignAsset() {
  if (!assignmentAsset.value) return

  loadingAssignment.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await assignAsset(assignmentAsset.value.id, selectedUserId.value)

    if (result.success) {
      successMessage.value = selectedUserId.value
        ? 'Asset assigned successfully!'
        : 'Asset unassigned successfully!'
      closeAssignmentModal()
      await loadAssets()
    } else {
      errorMessage.value = result.error || 'Failed to assign asset'
    }
  } catch (error) {
    console.error('Error assigning asset:', error)
    errorMessage.value = 'An unexpected error occurred. Please try again.'
  } finally {
    loadingAssignment.value = false
  }
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
.asset-management {
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
.assets-list-card {
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

.asset-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
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
.form-select {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s;
  background: white;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.form-input:disabled,
.form-select:disabled {
  background: #f7fafc;
  cursor: not-allowed;
  opacity: 0.6;
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

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #718096;
}

.assets-table {
  overflow-x: auto;
}

.assets-table table {
  width: 100%;
  border-collapse: collapse;
}

.assets-table th,
.assets-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.assets-table th {
  font-weight: 600;
  color: #4a5568;
  background: #f7fafc;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-in-use {
  background: #bee3f8;
  color: #2c5282;
}

.status-stock {
  background: #c6f6d5;
  color: #22543d;
}

.status-maintenance {
  background: #fed7aa;
  color: #c05621;
}

.status-retired {
  background: #e2e8f0;
  color: #4a5568;
}

.warranty-expired {
  color: #e53e3e;
  font-weight: 600;
}

.edit-button {
  padding: 6px 12px;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.edit-button:hover {
  background: #3182ce;
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

  .assets-table {
    font-size: 14px;
  }
}
</style>

