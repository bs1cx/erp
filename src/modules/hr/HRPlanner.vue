<template>
  <div class="hr-planner">
    <div class="section-header">
      <h2 class="section-title">HR Calendar & Planner</h2>
      <button @click="openCreateEventModal" class="primary-button">
        Create Event
      </button>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Calendar View Controls -->
    <div class="calendar-controls">
      <div class="view-controls">
        <button
          @click="changeView('month')"
          :class="['view-button', { active: currentView === 'month' }]"
        >
          Month
        </button>
        <button
          @click="changeView('week')"
          :class="['view-button', { active: currentView === 'week' }]"
        >
          Week
        </button>
        <button
          @click="changeView('day')"
          :class="['view-button', { active: currentView === 'day' }]"
        >
          Day
        </button>
      </div>
      <div class="date-navigation">
        <button @click="previousPeriod" class="nav-button">←</button>
        <span class="current-period">{{ formatPeriodTitle() }}</span>
        <button @click="nextPeriod" class="nav-button">→</button>
        <button @click="goToToday" class="today-button">Today</button>
      </div>
    </div>

    <!-- Calendar Grid -->
    <div v-if="loading" class="loading-state">
      Loading calendar events...
    </div>

    <div v-else class="calendar-container">
      <!-- Month View -->
      <div v-if="currentView === 'month'" class="month-view">
        <div class="calendar-header">
          <div v-for="day in weekDays" :key="day" class="day-header">
            {{ day }}
          </div>
        </div>
        <div class="calendar-grid">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            :class="['calendar-day', { 'other-month': !day.isCurrentMonth, 'today': day.isToday }]"
          >
            <div class="day-number">{{ day.date.getDate() }}</div>
            <div class="day-events">
              <div
                v-for="event in day.events"
                :key="event.id"
                :class="['event-item', `event-type-${event.event_type?.toLowerCase() || 'general'}`]"
                @click="openEventDetails(event)"
                :title="event.title"
              >
                {{ formatEventTime(event) }} {{ event.title }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Week View -->
      <div v-else-if="currentView === 'week'" class="week-view">
        <div class="week-header">
          <div class="time-column"></div>
          <div
            v-for="day in weekDaysList"
            :key="day.date.toISOString()"
            :class="['week-day-header', { today: day.isToday }]"
          >
            <div class="day-name">{{ day.name }}</div>
            <div class="day-date">{{ day.date.getDate() }}</div>
          </div>
        </div>
        <div class="week-grid">
          <div class="time-column">
            <div v-for="hour in hours" :key="hour" class="time-slot">
              {{ formatHour(hour) }}
            </div>
          </div>
          <div
            v-for="day in weekDaysList"
            :key="day.date.toISOString()"
            class="week-day-column"
          >
            <div
              v-for="hour in hours"
              :key="hour"
              class="time-cell"
              @click="openCreateEventAtTime(day.date, hour)"
            >
              <div
                v-for="event in getEventsForDayAndHour(day.date, hour)"
                :key="event.id"
                :class="['event-block', `event-type-${event.event_type?.toLowerCase() || 'general'}`]"
                @click.stop="openEventDetails(event)"
                :style="getEventStyle(event, day.date, hour)"
              >
                {{ event.title }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Day View -->
      <div v-else class="day-view">
        <div class="day-header">
          <h3>{{ formatDayTitle(currentDate) }}</h3>
        </div>
        <div class="day-timeline">
          <div
            v-for="hour in hours"
            :key="hour"
            class="timeline-hour"
            @click="openCreateEventAtTime(currentDate, hour)"
          >
            <div class="hour-label">{{ formatHour(hour) }}</div>
            <div class="hour-events">
              <div
                v-for="event in getEventsForDayAndHour(currentDate, hour)"
                :key="event.id"
                :class="['event-block', `event-type-${event.event_type?.toLowerCase() || 'general'}`]"
                @click.stop="openEventDetails(event)"
                :style="getEventStyle(event, currentDate, hour)"
              >
                <div class="event-title">{{ event.title }}</div>
                <div v-if="event.location" class="event-location">{{ event.location }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Event Modal -->
    <div v-if="showEventModal" class="modal-overlay" @click="closeEventModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingEvent ? 'Edit Event' : 'Create Event' }}</h3>
          <button @click="closeEventModal" class="modal-close">×</button>
        </div>

        <form @submit.prevent="handleSaveEvent" class="event-form">
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input
              v-model="eventForm.title"
              type="text"
              class="form-input"
              required
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea
              v-model="eventForm.description"
              class="form-textarea"
              rows="3"
              :disabled="loading"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date & Time *</label>
              <input
                v-model="eventForm.start_date"
                type="date"
                class="form-input"
                required
                :disabled="loading"
              />
              <input
                v-model="eventForm.start_time"
                type="time"
                class="form-input"
                required
                :disabled="loading"
              />
            </div>

            <div class="form-group">
              <label class="form-label">End Date & Time *</label>
              <input
                v-model="eventForm.end_date"
                type="date"
                class="form-input"
                required
                :disabled="loading"
              />
              <input
                v-model="eventForm.end_time"
                type="time"
                class="form-input"
                required
                :disabled="loading"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Event Type</label>
              <select
                v-model="eventForm.event_type"
                class="form-select"
                :disabled="loading"
              >
                <option value="General">General</option>
                <option value="Meeting">Meeting</option>
                <option value="Training">Training</option>
                <option value="Interview">Interview</option>
                <option value="Review">Review</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Assigned To</label>
              <select
                v-model="eventForm.assigned_user_id"
                class="form-select"
                :disabled="loading"
              >
                <option value="">Unassigned</option>
                <option
                  v-for="employee in employees"
                  :key="employee.id"
                  :value="employee.id"
                >
                  {{ employee.full_name || employee.email }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Location</label>
            <input
              v-model="eventForm.location"
              type="text"
              class="form-input"
              placeholder="Meeting room, address, etc."
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label class="form-label">
              <input
                v-model="eventForm.is_all_day"
                type="checkbox"
                :disabled="loading"
              />
              All Day Event
            </label>
          </div>

          <div class="modal-actions">
            <button
              v-if="editingEvent"
              type="button"
              @click="handleDeleteEvent"
              class="delete-button"
              :disabled="loading"
            >
              Delete
            </button>
            <button type="button" @click="closeEventModal" class="secondary-button" :disabled="loading">
              Cancel
            </button>
            <button type="submit" class="primary-button" :disabled="loading || !isEventFormValid">
              <span v-if="loading">Saving...</span>
              <span v-else>{{ editingEvent ? 'Update' : 'Create' }} Event</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Event Details Modal -->
    <div v-if="showDetailsModal && selectedEvent" class="modal-overlay" @click="closeDetailsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedEvent.title }}</h3>
          <button @click="closeDetailsModal" class="modal-close">×</button>
        </div>

        <div class="event-details">
          <div class="detail-item">
            <label>Type:</label>
            <span>{{ selectedEvent.event_type || 'General' }}</span>
          </div>
          <div class="detail-item">
            <label>Start:</label>
            <span>{{ formatEventDateTime(selectedEvent.start_datetime) }}</span>
          </div>
          <div class="detail-item">
            <label>End:</label>
            <span>{{ formatEventDateTime(selectedEvent.end_datetime) }}</span>
          </div>
          <div v-if="selectedEvent.location" class="detail-item">
            <label>Location:</label>
            <span>{{ selectedEvent.location }}</span>
          </div>
          <div v-if="selectedEvent.users" class="detail-item">
            <label>Assigned To:</label>
            <span>{{ getEmployeeName(selectedEvent.users) }}</span>
          </div>
          <div v-if="selectedEvent.description" class="detail-item full-width">
            <label>Description:</label>
            <p>{{ selectedEvent.description }}</p>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="editEvent(selectedEvent)" class="primary-button">
            Edit Event
          </button>
          <button @click="closeDetailsModal" class="secondary-button">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import {
  createCalendarEvent,
  getEventsForPeriod,
  updateCalendarEvent,
  deleteCalendarEvent
} from '../../services/hrService'
import { getAllCompanyEmployees } from '../../services/hrService'

const emit = defineEmits(['updated'])

const events = ref([])
const employees = ref([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showEventModal = ref(false)
const showDetailsModal = ref(false)
const selectedEvent = ref(null)
const editingEvent = ref(null)
const currentView = ref('month')
const currentDate = ref(new Date())

const eventForm = ref({
  title: '',
  description: '',
  start_date: '',
  start_time: '',
  end_date: '',
  end_time: '',
  event_type: 'General',
  assigned_user_id: '',
  location: '',
  is_all_day: false
})

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hours = Array.from({ length: 24 }, (_, i) => i)

const isEventFormValid = computed(() => {
  return eventForm.value.title &&
         eventForm.value.start_date &&
         eventForm.value.start_time &&
         eventForm.value.end_date &&
         eventForm.value.end_time
})

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - startDate.getDay())
  
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    
    days.push({
      date: new Date(date),
      isCurrentMonth: date.getMonth() === month,
      isToday: date.getTime() === today.getTime(),
      events: events.value.filter(e => {
        const eventDate = new Date(e.start_datetime).toISOString().split('T')[0]
        return eventDate === dateStr
      })
    })
  }
  
  return days
})

const weekDaysList = computed(() => {
  const startOfWeek = new Date(currentDate.value)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    days.push({
      date: new Date(date),
      name: weekDays[date.getDay()],
      isToday: date.getTime() === today.getTime()
    })
  }
  
  return days
})

onMounted(() => {
  loadEmployees()
  loadEvents()
})

async function loadEmployees() {
  try {
    const result = await getAllCompanyEmployees(1, 1000, {})
    if (result.success) {
      employees.value = result.employees || []
    }
  } catch (error) {
    console.error('Error loading employees:', error)
  }
}

async function loadEvents() {
  loading.value = true
  errorMessage.value = ''
  
  try {
    const startDate = getPeriodStart()
    const endDate = getPeriodEnd()
    
    const result = await getEventsForPeriod(
      startDate.toISOString(),
      endDate.toISOString()
    )
    
    if (result.success) {
      events.value = result.events || []
    } else {
      errorMessage.value = result.error || 'Failed to load calendar events'
    }
  } catch (error) {
    console.error('Error loading events:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

function getPeriodStart() {
  const date = new Date(currentDate.value)
  if (currentView.value === 'month') {
    date.setDate(1)
    date.setDate(date.getDate() - date.getDay())
  } else if (currentView.value === 'week') {
    date.setDate(date.getDate() - date.getDay())
  }
  date.setHours(0, 0, 0, 0)
  return date
}

function getPeriodEnd() {
  const date = new Date(currentDate.value)
  if (currentView.value === 'month') {
    date.setMonth(date.getMonth() + 1)
    date.setDate(0)
    date.setDate(date.getDate() + (6 - date.getDay()))
  } else if (currentView.value === 'week') {
    date.setDate(date.getDate() - date.getDay() + 6)
  } else {
    date.setDate(date.getDate() + 1)
  }
  date.setHours(23, 59, 59, 999)
  return date
}

function changeView(view) {
  currentView.value = view
  loadEvents()
}

function previousPeriod() {
  if (currentView.value === 'month') {
    currentDate.value.setMonth(currentDate.value.getMonth() - 1)
  } else if (currentView.value === 'week') {
    currentDate.value.setDate(currentDate.value.getDate() - 7)
  } else {
    currentDate.value.setDate(currentDate.value.getDate() - 1)
  }
  loadEvents()
}

function nextPeriod() {
  if (currentView.value === 'month') {
    currentDate.value.setMonth(currentDate.value.getMonth() + 1)
  } else if (currentView.value === 'week') {
    currentDate.value.setDate(currentDate.value.getDate() + 7)
  } else {
    currentDate.value.setDate(currentDate.value.getDate() + 1)
  }
  loadEvents()
}

function goToToday() {
  currentDate.value = new Date()
  loadEvents()
}

function formatPeriodTitle() {
  if (currentView.value === 'month') {
    return currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } else if (currentView.value === 'week') {
    const start = weekDaysList.value[0].date
    const end = weekDaysList.value[6].date
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  } else {
    return formatDayTitle(currentDate.value)
  }
}

function formatDayTitle(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatHour(hour) {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

function formatEventTime(event) {
  if (event.is_all_day) return 'All Day'
  const start = new Date(event.start_datetime)
  return start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatEventDateTime(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function getEventsForDayAndHour(day, hour) {
  return events.value.filter(event => {
    const eventDate = new Date(event.start_datetime)
    const eventDay = eventDate.toDateString()
    const eventHour = eventDate.getHours()
    return eventDay === day.toDateString() && eventHour === hour
  })
}

function getEventStyle(event, day, hour) {
  const start = new Date(event.start_datetime)
  const end = new Date(event.end_datetime)
  const duration = (end - start) / (1000 * 60) // minutes
  const height = Math.max(30, (duration / 60) * 60) // pixels
  
  return {
    height: `${height}px`,
    top: `${(start.getMinutes() / 60) * 60}px`
  }
}

function openCreateEventModal() {
  editingEvent.value = null
  eventForm.value = {
    title: '',
    description: '',
    start_date: currentDate.value.toISOString().split('T')[0],
    start_time: '09:00',
    end_date: currentDate.value.toISOString().split('T')[0],
    end_time: '10:00',
    event_type: 'General',
    assigned_user_id: '',
    location: '',
    is_all_day: false
  }
  showEventModal.value = true
}

function openCreateEventAtTime(date, hour) {
  editingEvent.value = null
  const startDate = new Date(date)
  startDate.setHours(hour, 0, 0, 0)
  const endDate = new Date(startDate)
  endDate.setHours(hour + 1, 0, 0, 0)
  
  eventForm.value = {
    title: '',
    description: '',
    start_date: startDate.toISOString().split('T')[0],
    start_time: startDate.toTimeString().slice(0, 5),
    end_date: endDate.toISOString().split('T')[0],
    end_time: endDate.toTimeString().slice(0, 5),
    event_type: 'General',
    assigned_user_id: '',
    location: '',
    is_all_day: false
  }
  showEventModal.value = true
}

function openEventDetails(event) {
  selectedEvent.value = event
  showDetailsModal.value = true
}

function closeDetailsModal() {
  showDetailsModal.value = false
  selectedEvent.value = null
}

function editEvent(event) {
  editingEvent.value = event
  const start = new Date(event.start_datetime)
  const end = new Date(event.end_datetime)
  
  eventForm.value = {
    title: event.title,
    description: event.description || '',
    start_date: start.toISOString().split('T')[0],
    start_time: start.toTimeString().slice(0, 5),
    end_date: end.toISOString().split('T')[0],
    end_time: end.toTimeString().slice(0, 5),
    event_type: event.event_type || 'General',
    assigned_user_id: event.assigned_user_id || '',
    location: event.location || '',
    is_all_day: event.is_all_day || false
  }
  
  showDetailsModal.value = false
  showEventModal.value = true
}

function closeEventModal() {
  showEventModal.value = false
  editingEvent.value = null
  eventForm.value = {
    title: '',
    description: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    event_type: 'General',
    assigned_user_id: '',
    location: '',
    is_all_day: false
  }
}

async function handleSaveEvent() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const startDatetime = new Date(`${eventForm.value.start_date}T${eventForm.value.start_time}`)
    const endDatetime = new Date(`${eventForm.value.end_date}T${eventForm.value.end_time}`)
    
    const eventData = {
      title: eventForm.value.title,
      description: eventForm.value.description,
      start_datetime: startDatetime.toISOString(),
      end_datetime: endDatetime.toISOString(),
      event_type: eventForm.value.event_type,
      assigned_user_id: eventForm.value.assigned_user_id || null,
      location: eventForm.value.location,
      is_all_day: eventForm.value.is_all_day
    }

    let result
    if (editingEvent.value) {
      result = await updateCalendarEvent(editingEvent.value.id, eventData)
    } else {
      result = await createCalendarEvent(eventData)
    }

    if (result.success) {
      successMessage.value = editingEvent.value ? 'Event updated successfully!' : 'Event created successfully!'
      closeEventModal()
      await loadEvents()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to save event'
    }
  } catch (error) {
    console.error('Error saving event:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

async function handleDeleteEvent() {
  if (!confirm('Are you sure you want to delete this event?')) return

  loading.value = true
  try {
    const result = await deleteCalendarEvent(editingEvent.value.id)
    if (result.success) {
      successMessage.value = 'Event deleted successfully!'
      closeEventModal()
      await loadEvents()
      emit('updated')
    } else {
      errorMessage.value = result.error || 'Failed to delete event'
    }
  } catch (error) {
    console.error('Error deleting event:', error)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

function getEmployeeName(user) {
  if (!user) return 'Unassigned'
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  return fullName || user.email || 'Unassigned'
}
</script>

<style scoped>
.hr-planner {
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

.primary-button {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.primary-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-button {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-surface);
  color: var(--color-text-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.secondary-button:hover:not(:disabled) {
  background: var(--color-border-light);
}

.delete-button {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.delete-button:hover:not(:disabled) {
  background: var(--color-danger-dark);
}

.calendar-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.view-controls {
  display: flex;
  gap: var(--spacing-sm);
}

.view-button {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-background);
  color: var(--color-text-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.view-button:hover {
  background: var(--color-surface);
}

.view-button.active {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border-color: var(--color-primary);
}

.date-navigation {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.nav-button,
.today-button {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-background);
  color: var(--color-text-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.nav-button:hover,
.today-button:hover {
  background: var(--color-surface);
}

.current-period {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-dark);
  min-width: 200px;
  text-align: center;
}

.calendar-container {
  background: var(--color-background);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.month-view {
  display: flex;
  flex-direction: column;
}

.calendar-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--color-surface);
  border-bottom: 2px solid var(--color-border);
}

.day-header {
  padding: var(--spacing-md);
  text-align: center;
  font-weight: 600;
  color: var(--color-text-medium);
  border-right: 1px solid var(--color-border);
}

.day-header:last-child {
  border-right: none;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.calendar-day {
  min-height: 120px;
  padding: var(--spacing-sm);
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background);
}

.calendar-day.other-month {
  background: var(--color-surface);
  opacity: 0.5;
}

.calendar-day.today {
  background: rgba(42, 99, 62, 0.05);
}

.day-number {
  font-weight: 600;
  color: var(--color-text-dark);
  margin-bottom: var(--spacing-xs);
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.event-item {
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all var(--transition-base);
}

.event-item:hover {
  opacity: 0.8;
  transform: translateX(2px);
}

.event-type-general {
  background: var(--color-primary-light);
  color: var(--color-text-on-primary);
}

.event-type-meeting {
  background: var(--color-info-light);
  color: var(--color-text-on-primary);
}

.event-type-training {
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
}

.event-type-interview {
  background: var(--color-warning);
  color: var(--color-text-on-primary);
}

.event-type-review {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
}

.week-view,
.day-view {
  display: flex;
  flex-direction: column;
}

.week-header {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  background: var(--color-surface);
  border-bottom: 2px solid var(--color-border);
}

.week-day-header {
  padding: var(--spacing-md);
  text-align: center;
  border-right: 1px solid var(--color-border);
}

.week-day-header.today {
  background: rgba(42, 99, 62, 0.1);
}

.day-name {
  font-weight: 600;
  color: var(--color-text-medium);
  font-size: var(--font-size-sm);
}

.day-date {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-dark);
  margin-top: var(--spacing-xs);
}

.week-grid {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  overflow-y: auto;
  max-height: 600px;
}

.time-column {
  background: var(--color-surface);
  border-right: 2px solid var(--color-border);
}

.time-slot {
  height: 60px;
  padding: var(--spacing-xs);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-medium);
  text-align: right;
}

.week-day-column {
  border-right: 1px solid var(--color-border);
}

.time-cell {
  height: 60px;
  border-bottom: 1px solid var(--color-border);
  position: relative;
  cursor: pointer;
  transition: background var(--transition-base);
}

.time-cell:hover {
  background: rgba(42, 99, 62, 0.05);
}

.event-block {
  position: absolute;
  left: 2px;
  right: 2px;
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  z-index: 1;
}

.event-title {
  font-weight: 600;
}

.event-location {
  font-size: var(--font-size-xs);
  opacity: 0.8;
  margin-top: var(--spacing-xs);
}

.day-timeline {
  overflow-y: auto;
  max-height: 600px;
}

.timeline-hour {
  display: grid;
  grid-template-columns: 80px 1fr;
  min-height: 60px;
  border-bottom: 1px solid var(--color-border);
  position: relative;
}

.hour-label {
  padding: var(--spacing-sm);
  background: var(--color-surface);
  border-right: 2px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-medium);
  text-align: right;
}

.hour-events {
  padding: var(--spacing-sm);
  position: relative;
  cursor: pointer;
}

.hour-events:hover {
  background: rgba(42, 99, 62, 0.05);
}

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

.event-form {
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
  gap: var(--spacing-xs);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-dark);
}

.form-input,
.form-select,
.form-textarea {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--color-background);
  transition: all var(--transition-base);
  font-family: inherit;
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
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-lg);
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.detail-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.detail-item.full-width {
  flex-direction: column;
}

.detail-item label {
  font-weight: 600;
  color: var(--color-text-medium);
  min-width: 120px;
}

.detail-item span,
.detail-item p {
  color: var(--color-text-dark);
}

.success-message {
  padding: var(--spacing-md);
  background: var(--color-success-light);
  color: var(--color-text-on-primary);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}

.error-message {
  padding: var(--spacing-md);
  background: var(--color-danger-light);
  color: var(--color-text-on-primary);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}

.loading-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-medium);
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .calendar-controls {
    flex-direction: column;
  }
}
</style>

