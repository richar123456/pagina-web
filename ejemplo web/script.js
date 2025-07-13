// ===== VARIABLES GLOBALES =====
let tasks = []; // Array principal para almacenar todas las tareas
let currentFilter = 'all'; // Filtro actual aplicado
let currentSort = 'date'; // Ordenamiento actual
let editingTaskId = null; // ID de la tarea que se está editando
let taskIdCounter = 1; // Contador para IDs únicos

// ===== ELEMENTOS DEL DOM =====
// Cacheo de elementos para mejor rendimiento
const elements = {
    // Formulario principal
    taskForm: document.getElementById('taskForm'),
    taskTitle: document.getElementById('taskTitle'),
    taskDescription: document.getElementById('taskDescription'),
    taskPriority: document.getElementById('taskPriority'),
    taskDueDate: document.getElementById('taskDueDate'),
    
    // Filtros y búsqueda
    searchInput: document.getElementById('searchInput'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    sortSelect: document.getElementById('sortSelect'),
    
    // Contenedores de tareas
    tasksGrid: document.getElementById('tasksGrid'),
    emptyState: document.getElementById('emptyState'),
    
    // Estadísticas
    totalTasks: document.getElementById('totalTasks'),
    completedTasks: document.getElementById('completedTasks'),
    pendingTasks: document.getElementById('pendingTasks'),
    
    // Modal de edición
    editModal: document.getElementById('editModal'),
    editForm: document.getElementById('editForm'),
    editTitle: document.getElementById('editTitle'),
    editDescription: document.getElementById('editDescription'),
    editPriority: document.getElementById('editPriority'),
    editDueDate: document.getElementById('editDueDate'),
    modalClose: document.getElementById('modalClose'),
    cancelEdit: document.getElementById('cancelEdit'),
    
    // Notificaciones
    notifications: document.getElementById('notifications')
};

/**
 * ===== CLASE TASK =====
 * Representa una tarea individual con todas sus propiedades
 */
class Task {
    constructor(title, description, priority, dueDate) {
        this.id = taskIdCounter++;
        this.title = title;
        this.description = description;
        this.priority = priority;
        this.dueDate = dueDate;
        this.completed = false;
        this.createdAt = new Date();
        this.completedAt = null;
    }
    
    /**
     * Marca la tarea como completada o pendiente
     */
    toggleComplete() {
        this.completed = !this.completed;
        this.completedAt = this.completed ? new Date() : null;
    }
    
    /**
     * Verifica si la tarea está vencida
     */
    isOverdue() {
        if (!this.dueDate || this.completed) return false;
        return new Date(this.dueDate) < new Date();
    }
    
    /**
     * Obtiene el valor numérico de la prioridad para ordenamiento
     */
    getPriorityValue() {
        const priorityValues = { high: 3, medium: 2, low: 1 };
        return priorityValues[this.priority] || 0;
    }
}

/**
 * ===== SISTEMA DE NOTIFICACIONES =====
 * Maneja mensajes temporales para el usuario
 */
class NotificationSystem {
    /**
     * Muestra una notificación
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo de notificación (success, error, warning, info)
     * @param {number} duration - Duración en milisegundos
     */
    show(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Iconos según el tipo
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="${icons[type]}"></i>
            <span>${message}</span>
        `;
        
        elements.notifications.appendChild(notification);
        
        // Mostrar con animación
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remover después del tiempo especificado
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
}

// Instancia global del sistema de notificaciones
const notifications = new NotificationSystem();

/**
 * ===== FUNCIONES DE GESTIÓN DE TAREAS =====
 */

/**
 * Agrega una nueva tarea
 * @param {string} title - Título de la tarea
 * @param {string} description - Descripción de la tarea
 * @param {string} priority - Prioridad (low, medium, high)
 * @param {string} dueDate - Fecha límite
 */
function addTask(title, description, priority, dueDate) {
    const task = new Task(title, description, priority, dueDate);
    tasks.push(task);
    
    // Guardar en localStorage
    saveTasksToStorage();
    
    // Actualizar interfaz
    updateUI();
    
    // Mostrar notificación
    notifications.show('✅ Tarea agregada exitosamente', 'success');
    
    // Limpiar formulario
    elements.taskForm.reset();
}

/**
 * Elimina una tarea por su ID
 * @param {number} taskId - ID de la tarea a eliminar
 */
function deleteTask(taskId) {
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return;
    
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskCard) {
        taskCard.classList.add('removing');
        setTimeout(() => {
            tasks.splice(taskIndex, 1);
            saveTasksToStorage();
            updateUI();
            notifications.show('🗑️ Tarea eliminada', 'info');
        }, 300);
    }
}

/**
 * Alterna el estado de completado de una tarea
 * @param {number} taskId - ID de la tarea
 */
function toggleTaskComplete(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    task.toggleComplete();
    saveTasksToStorage();
    updateUI();
    
    const message = task.completed ? 
        '✅ Tarea completada' : 
        '↩️ Tarea marcada como pendiente';
    notifications.show(message, 'success');
}

/**
 * Inicia el proceso de edición de una tarea
 * @param {number} taskId - ID de la tarea a editar
 */
function startEditTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    editingTaskId = taskId;
    
    // Llenar el formulario de edición
    elements.editTitle.value = task.title;
    elements.editDescription.value = task.description;
    elements.editPriority.value = task.priority;
    elements.editDueDate.value = task.dueDate;
    
    // Mostrar modal
    showModal();
}

/**
 * Guarda los cambios de una tarea editada
 */
function saveEditTask() {
    if (!editingTaskId) return;
    
    const task = tasks.find(t => t.id === editingTaskId);
    if (!task) return;
    
    // Actualizar propiedades
    task.title = elements.editTitle.value.trim();
    task.description = elements.editDescription.value.trim();
    task.priority = elements.editPriority.value;
    task.dueDate = elements.editDueDate.value;
    
    // Guardar y actualizar
    saveTasksToStorage();
    updateUI();
    hideModal();
    
    notifications.show('✏️ Tarea actualizada', 'success');
}

/**
 * ===== FUNCIONES DE FILTRADO Y ORDENAMIENTO =====
 */

/**
 * Filtra las tareas según el criterio actual
 * @param {string} searchQuery - Texto de búsqueda
 * @returns {Array} - Array de tareas filtradas
 */
function getFilteredTasks(searchQuery = '') {
    let filteredTasks = [...tasks];
    
    // Filtrar por estado
    switch (currentFilter) {
        case 'completed':
            filteredTasks = filteredTasks.filter(task => task.completed);
            break;
        case 'pending':
            filteredTasks = filteredTasks.filter(task => !task.completed);
            break;
        // 'all' no necesita filtrado adicional
    }
    
    // Filtrar por texto de búsqueda
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredTasks = filteredTasks.filter(task => 
            task.title.toLowerCase().includes(query) ||
            task.description.toLowerCase().includes(query)
        );
    }
    
    // Ordenar tareas
    return sortTasks(filteredTasks);
}

/**
 * Ordena las tareas según el criterio actual
 * @param {Array} tasksToSort - Array de tareas a ordenar
 * @returns {Array} - Array ordenado
 */
function sortTasks(tasksToSort) {
    return tasksToSort.sort((a, b) => {
        switch (currentSort) {
            case 'priority':
                return b.getPriorityValue() - a.getPriorityValue();
            case 'title':
                return a.title.localeCompare(b.title);
            case 'date':
            default:
                return new Date(b.createdAt) - new Date(a.createdAt);
        }
    });
}

/**
 * ===== FUNCIONES DE INTERFAZ =====
 */

/**
 * Actualiza toda la interfaz de usuario
 */
function updateUI() {
    updateStats();
    renderTasks();
    updateEmptyState();
}

/**
 * Actualiza las estadísticas en el header - VERSIÓN CORREGIDA
 */
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const pending = total - completed;
    
    // Actualización directa sin animación problemática
    if (elements.totalTasks) {
        elements.totalTasks.textContent = total;
    }
    if (elements.completedTasks) {
        elements.completedTasks.textContent = completed;
    }
    if (elements.pendingTasks) {
        elements.pendingTasks.textContent = pending;
    }
}

/**
 * Renderiza la lista de tareas
 */
function renderTasks() {
    const searchQuery = elements.searchInput.value;
    const filteredTasks = getFilteredTasks(searchQuery);
    
    elements.tasksGrid.innerHTML = '';
    
    filteredTasks.forEach(task => {
        const taskCard = createTaskCard(task);
        elements.tasksGrid.appendChild(taskCard);
    });
}

/**
 * Crea el HTML de una tarjeta de tarea
 * @param {Task} task - Objeto tarea
 * @returns {Element} - Elemento DOM de la tarjeta
 */
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority}`;
    card.setAttribute('data-task-id', task.id);
    
    if (task.completed) {
        card.classList.add('completed');
    }
    
    // Formatear fecha
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Sin fecha';
    const isOverdue = task.isOverdue();
    
    card.innerHTML = `
        <div class="task-header">
            <div>
                <h3 class="task-title ${task.completed ? 'completed' : ''}">${task.title}</h3>
                <p class="task-description">${task.description || 'Sin descripción'}</p>
            </div>
        </div>
        
        <div class="task-meta">
            <span class="task-priority ${task.priority}">${getPriorityText(task.priority)}</span>
            <span class="task-due-date ${isOverdue ? 'overdue' : ''}">
                <i class="fas fa-calendar-alt"></i>
                ${dueDate}
            </span>
        </div>
        
        <div class="task-actions">
            <button class="task-action complete" onclick="toggleTaskComplete(${task.id})">
                <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i>
                ${task.completed ? 'Deshacer' : 'Completar'}
            </button>
            <button class="task-action edit" onclick="startEditTask(${task.id})">
                <i class="fas fa-edit"></i>
                Editar
            </button>
            <button class="task-action delete" onclick="confirmDeleteTask(${task.id})">
                <i class="fas fa-trash"></i>
                Eliminar
            </button>
        </div>
    `;
    
    return card;
}

/**
 * Obtiene el texto de la prioridad
 * @param {string} priority - Prioridad de la tarea
 * @returns {string} - Texto de la prioridad
 */
function getPriorityText(priority) {
    const priorityTexts = {
        high: 'Alta',
        medium: 'Media',
        low: 'Baja'
    };
    return priorityTexts[priority] || 'Media';
}

/**
 * Confirma la eliminación de una tarea
 * @param {number} taskId - ID de la tarea
 */
function confirmDeleteTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    if (confirm(`¿Estás seguro de que quieres eliminar la tarea "${task.title}"?`)) {
        deleteTask(taskId);
    }
}

/**
 * Actualiza el estado vacío
 */
function updateEmptyState() {
    const searchQuery = elements.searchInput.value;
    const filteredTasks = getFilteredTasks(searchQuery);
    
    if (filteredTasks.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.tasksGrid.classList.add('hidden');
    } else {
        elements.emptyState.classList.add('hidden');
        elements.tasksGrid.classList.remove('hidden');
    }
}

/**
 * ===== FUNCIONES DE MODAL =====
 */

/**
 * Muestra el modal de edición
 */
function showModal() {
    elements.editModal.classList.add('show');
    document.body.classList.add('no-scroll');
    elements.editTitle.focus();
}

/**
 * Oculta el modal de edición
 */
function hideModal() {
    elements.editModal.classList.remove('show');
    document.body.classList.remove('no-scroll');
    editingTaskId = null;
    elements.editForm.reset();
}

/**
 * ===== FUNCIONES DE ALMACENAMIENTO =====
 */

/**
 * Guarda las tareas en localStorage
 */
function saveTasksToStorage() {
    try {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        localStorage.setItem('taskIdCounter', taskIdCounter.toString());
    } catch (error) {
        console.error('Error al guardar tareas:', error);
        notifications.show('Error al guardar los datos', 'error');
    }
}

/**
 * Carga las tareas desde localStorage
 */
function loadTasksFromStorage() {
    try {
        const savedTasks = localStorage.getItem('tasks');
        const savedCounter = localStorage.getItem('taskIdCounter');
        
        if (savedTasks) {
            const taskData = JSON.parse(savedTasks);
            tasks = taskData.map(data => {
                const task = new Task(data.title, data.description, data.priority, data.dueDate);
                task.id = data.id;
                task.completed = data.completed;
                task.createdAt = new Date(data.createdAt);
                task.completedAt = data.completedAt ? new Date(data.completedAt) : null;
                return task;
            });
        }
        
        if (savedCounter) {
            taskIdCounter = parseInt(savedCounter);
        }
    } catch (error) {
        console.error('Error al cargar tareas:', error);
        notifications.show('Error al cargar los datos guardados', 'error');
    }
}

/**
 * ===== EVENT LISTENERS =====
 */

/**
 * Inicializa todos los event listeners
 */
function initEventListeners() {
    // Formulario principal
    elements.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = elements.taskTitle.value.trim();
        const description = elements.taskDescription.value.trim();
        const priority = elements.taskPriority.value;
        const dueDate = elements.taskDueDate.value;
        
        if (!title) {
            notifications.show('El título es obligatorio', 'error');
            return;
        }
        
        addTask(title, description, priority, dueDate);
    });
    
    // Búsqueda en tiempo real
    elements.searchInput.addEventListener('input', (e) => {
        renderTasks();
        updateEmptyState();
    });
    
    // Filtros
    elements.filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Actualizar botones activos
            elements.filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Actualizar filtro actual
            currentFilter = button.dataset.filter;
            renderTasks();
            updateEmptyState();
        });
    });
    
    // Ordenamiento
    elements.sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderTasks();
    });
    
    // Modal de edición
    elements.editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = elements.editTitle.value.trim();
        if (!title) {
            notifications.show('El título es obligatorio', 'error');
            return;
        }
        
        saveEditTask();
    });
    
    // Cerrar modal
    elements.modalClose.addEventListener('click', hideModal);
    elements.cancelEdit.addEventListener('click', hideModal);
    
    // Cerrar modal con clic fuera
    elements.editModal.addEventListener('click', (e) => {
        if (e.target === elements.editModal) {
            hideModal();
        }
    });
    
    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.editModal.classList.contains('show')) {
            hideModal();
        }
    });
}

/**
 * ===== INICIALIZACIÓN =====
 */

/**
 * Inicializa la aplicación
 */
function initApp() {
    console.log('🚀 Iniciando Dashboard de Tareas...');
    
    // Cargar datos guardados
    loadTasksFromStorage();
    
    // Configurar fecha mínima para el campo de fecha
    const today = new Date().toISOString().split('T')[0];
    elements.taskDueDate.min = today;
    elements.editDueDate.min = today;
    
    // Inicializar event listeners
    initEventListeners();
    
    // Renderizar interfaz inicial
    updateUI();
    
    // Mensaje de bienvenida
    notifications.show('¡Bienvenido al Dashboard de Tareas!', 'success');
    
    console.log('✅ Dashboard de Tareas iniciado correctamente');
}

/**
 * ===== EJECUCIÓN AL CARGAR LA PÁGINA =====
 */
document.addEventListener('DOMContentLoaded', initApp);

/**
 * ===== FUNCIONES ADICIONALES =====
 */

/**
 * Limpia todas las tareas completadas
 */
function clearCompletedTasks() {
    const completedCount = tasks.filter(task => task.completed).length;
    
    if (completedCount === 0) {
        notifications.show('No hay tareas completadas para eliminar', 'info');
        return;
    }
    
    if (confirm(`¿Eliminar ${completedCount} tarea(s) completada(s)?`)) {
        tasks = tasks.filter(task => !task.completed);
        saveTasksToStorage();
        updateUI();
        notifications.show(`🗑️ ${completedCount} tarea(s) eliminada(s)`, 'success');
    }
}

/**
 * Exporta las tareas como JSON
 */
function exportTasks() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `tareas-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    notifications.show('📁 Tareas exportadas exitosamente', 'success');
}

/**
 * Obtiene estadísticas avanzadas
 */
function getAdvancedStats() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const overdue = tasks.filter(task => task.isOverdue()).length;
    const highPriority = tasks.filter(task => task.priority === 'high').length;
    
    return {
        total,
        completed,
        pending: total - completed,
        overdue,
        highPriority,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

// Exponer funciones globales para uso en HTML
window.toggleTaskComplete = toggleTaskComplete;
window.startEditTask = startEditTask;
window.confirmDeleteTask = confirmDeleteTask;
window.clearCompletedTasks = clearCompletedTasks;
window.exportTasks = exportTasks;
