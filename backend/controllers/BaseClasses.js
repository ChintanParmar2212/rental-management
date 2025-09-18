// ===================================
// STEP 1: Create helper classes in existing controllers directory
// File: backend/controllers/BaseClasses.js
// ===================================

/**
 * Abstract base class for all property types
 * Demonstrates: Abstraction, Encapsulation
 */
class BaseProperty {
    #id;
    #userId;
    #createdAt;
    #updatedAt;

    constructor(userId, data = {}) {
        if (this.constructor === BaseProperty) {
            throw new Error("Abstract class BaseProperty cannot be instantiated directly");
        }
        this.#id = data._id || data.id;
        this.#userId = userId;
        this.#createdAt = data.createdAt || new Date();
        this.#updatedAt = data.updatedAt || new Date();
    }

    // Abstract methods (must be implemented by subclasses)
    validate() {
        throw new Error("validate() method must be implemented by subclass");
    }

    calculateValue() {
        throw new Error("calculateValue() method must be implemented by subclass");
    }

    // Encapsulated getters
    getId() { return this.#id; }
    getUserId() { return this.#userId; }
    getCreatedAt() { return this.#createdAt; }
    getUpdatedAt() { return this.#updatedAt; }

    _updateTimestamp() {
        this.#updatedAt = new Date();
    }
}

/**
 * Enhanced Flat class extending BaseProperty
 * Demonstrates: Inheritance, Polymorphism, Encapsulation
 */
class EnhancedFlat extends BaseProperty {
    #title;
    #description;
    #vacant;
    #inspectionDate;
    #images;
    #tenantDetails;

    constructor(userId, flatData) {
        super(userId, flatData);
        this.#title = flatData.title;
        this.#description = flatData.description || '';
        this.#vacant = flatData.vacant !== undefined ? flatData.vacant : true;
        this.#inspectionDate = flatData.inspectionDate || null;
        this.#images = flatData.images || [];
        this.#tenantDetails = flatData.tenantDetails || null;
    }

    // Polymorphic implementation of abstract method
    validate() {
        const errors = [];
        
        if (!this.#title || this.#title.trim().length === 0) {
            errors.push('Title is required for flat');
        }
        
        if (this.#title && this.#title.length > 200) {
            errors.push('Title must be less than 200 characters');
        }
        
        if (this.#inspectionDate && new Date(this.#inspectionDate) < new Date()) {
            errors.push('Inspection date cannot be in the past');
        }
        
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
        
        return true;
    }

    // Polymorphic implementation of abstract method
    calculateValue() {
        if (!this.#vacant && this.#tenantDetails?.rentAmount) {
            return this.#tenantDetails.rentAmount * 12; // Annual rent value
        }
        return 0;
    }

    // Public methods with encapsulation
    getTitle() { return this.#title; }
    getDescription() { return this.#description; }
    isVacant() { return this.#vacant; }
    getInspectionDate() { return this.#inspectionDate; }
    getImages() { return [...this.#images]; }
    getTenantDetails() { return this.#tenantDetails ? {...this.#tenantDetails} : null; }

    setTitle(title) {
        this.#title = title;
        this._updateTimestamp();
    }

    setDescription(description) {
        this.#description = description;
        this._updateTimestamp();
    }

    setVacant(vacant) {
        this.#vacant = vacant;
        if (vacant) {
            this.#tenantDetails = null;
        }
        this._updateTimestamp();
    }

    addImage(imageUrl) {
        this.#images.push(imageUrl);
        this._updateTimestamp();
    }

    removeImage(imageUrl) {
        this.#images = this.#images.filter(img => img !== imageUrl);
        this._updateTimestamp();
    }

    setTenantDetails(tenantDetails) {
        this.#tenantDetails = tenantDetails;
        if (tenantDetails) {
            this.#vacant = false;
        }
        this._updateTimestamp();
    }

    // Convert to plain object for database storage
    toJSON() {
        return {
            _id: this.getId(),
            userId: this.getUserId(),
            title: this.#title,
            description: this.#description,
            vacant: this.#vacant,
            inspectionDate: this.#inspectionDate,
            images: this.#images,
            tenantDetails: this.#tenantDetails,
            createdAt: this.getCreatedAt(),
            updatedAt: this.getUpdatedAt()
        };
    }

    // Create from existing MongoDB document
    static fromDocument(doc) {
        return new EnhancedFlat(doc.userId, {
            _id: doc._id,
            title: doc.title,
            description: doc.description,
            vacant: doc.vacant,
            inspectionDate: doc.inspectionDate,
            images: doc.images,
            tenantDetails: doc.tenantDetails,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        });
    }
}

/**
 * User classes demonstrating inheritance hierarchy
 * Demonstrates: Inheritance, Polymorphism
 */
class BaseUser {
    #id;
    #name;
    #email;
    #role;

    constructor(userData) {
        this.#id = userData._id || userData.id;
        this.#name = userData.name;
        this.#email = userData.email;
        this.#role = userData.role || 'user';
    }

    getId() { return this.#id; }
    getName() { return this.#name; }
    getEmail() { return this.#email; }
    getRole() { return this.#role; }

    // Virtual method to be overridden
    getPermissions() {
        return ['read_own_flats'];
    }

    // Virtual method to be overridden
    canAccessFlat(flat) {
        return flat.getUserId().toString() === this.#id.toString();
    }
}

class AdminUser extends BaseUser {
    constructor(userData) {
        super({...userData, role: 'admin'});
    }

    // Polymorphic override
    getPermissions() {
        return ['read_all_flats', 'write_all_flats', 'delete_all_flats', 'manage_users'];
    }

    // Polymorphic override
    canAccessFlat(flat) {
        return true; // Admins can access all flats
    }
}

class PropertyManagerUser extends BaseUser {
    #managedProperties;

    constructor(userData) {
        super({...userData, role: 'property_manager'});
        this.#managedProperties = userData.managedProperties || [];
    }

    // Polymorphic override
    getPermissions() {
        return ['read_managed_flats', 'write_managed_flats', 'read_own_flats'];
    }

    // Polymorphic override
    canAccessFlat(flat) {
        return super.canAccessFlat(flat) || this.#managedProperties.includes(flat.getId());
    }
}

/**
 * Configuration Manager Singleton
 * Demonstrates: Singleton Pattern
 */
class ConfigManager {
    static #instance = null;
    #config = {};

    constructor() {
        if (ConfigManager.#instance) {
            return ConfigManager.#instance;
        }
        ConfigManager.#instance = this;
        this.#loadDefaultConfig();
    }

    static getInstance() {
        if (!ConfigManager.#instance) {
            ConfigManager.#instance = new ConfigManager();
        }
        return ConfigManager.#instance;
    }

    #loadDefaultConfig() {
        this.#config = {
            imageUploadPath: '/uploads/flats/',
            maxImageSize: 5 * 1024 * 1024, // 5MB
            allowedImageTypes: ['jpg', 'jpeg', 'png', 'gif'],
            maxImagesPerFlat: 10,
            validation: {
                maxTitleLength: 200,
                minTitleLength: 1
            }
        };
    }

    get(key) {
        return this.#config[key];
    }

    set(key, value) {
        this.#config[key] = value;
    }
}

/**
 * User Factory
 * Demonstrates: Factory Pattern
 */
class UserFactory {
    static createUser(userData) {
        if (!userData) {
            throw new Error('User data is required');
        }

        switch (userData.role) {
            case 'admin':
                return new AdminUser(userData);
            case 'property_manager':
                return new PropertyManagerUser(userData);
            default:
                return new BaseUser(userData);
        }
    }

    static createUserFromRequest(req) {
        if (!req.user) {
            throw new Error('No user found in request');
        }
        return this.createUser(req.user);
    }
}

/**
 * Sorting Strategies
 * Demonstrates: Strategy Pattern
 */
class SortStrategy {
    sort(flats) {
        throw new Error("sort() method must be implemented by strategy");
    }
}

class DateSortStrategy extends SortStrategy {
    sort(flats) {
        return [...flats].sort((a, b) => new Date(b.getCreatedAt()) - new Date(a.getCreatedAt()));
    }
}

class TitleSortStrategy extends SortStrategy {
    sort(flats) {
        return [...flats].sort((a, b) => a.getTitle().localeCompare(b.getTitle()));
    }
}

class ValueSortStrategy extends SortStrategy {
    sort(flats) {
        return [...flats].sort((a, b) => b.calculateValue() - a.calculateValue());
    }
}

class VacancySortStrategy extends SortStrategy {
    sort(flats) {
        return [...flats].sort((a, b) => {
            if (a.isVacant() === b.isVacant()) return 0;
            return a.isVacant() ? 1 : -1; // Occupied first
        });
    }
}

class FlatSorter {
    #strategy;

    constructor(strategy) {
        this.#strategy = strategy;
    }

    setStrategy(strategy) {
        this.#strategy = strategy;
    }

    sort(flats) {
        return this.#strategy.sort(flats);
    }

    static createSorter(sortBy) {
        let strategy;
        switch (sortBy) {
            case 'title':
                strategy = new TitleSortStrategy();
                break;
            case 'value':
                strategy = new ValueSortStrategy();
                break;
            case 'vacancy':
                strategy = new VacancySortStrategy();
                break;
            default:
                strategy = new DateSortStrategy();
        }
        return new FlatSorter(strategy);
    }
}

/**
 * Validation Chain - Chain of Responsibility Pattern
 * Demonstrates: Chain of Responsibility Pattern
 */
class ValidationHandler {
    constructor() {
        this.nextHandler = null;
    }

    setNext(handler) {
        this.nextHandler = handler;
        return handler;
    }

    handle(data) {
        if (this.validate(data)) {
            if (this.nextHandler) {
                return this.nextHandler.handle(data);
            }
            return { success: true, message: 'All validations passed' };
        }
        return { success: false, message: this.getErrorMessage() };
    }

    validate(data) {
        return true; // Default implementation
    }

    getErrorMessage() {
        return 'Validation failed';
    }
}

class TitleValidationHandler extends ValidationHandler {
    validate(data) {
        return data.title && data.title.trim().length > 0 && data.title.length <= 200;
    }

    getErrorMessage() {
        return 'Title is required and must be less than 200 characters';
    }
}

class ImageValidationHandler extends ValidationHandler {
    validate(data) {
        if (!data.files) return true; // No files is okay
        
        const config = ConfigManager.getInstance();
        const maxSize = config.get('maxImageSize');
        const allowedTypes = config.get('allowedImageTypes');
        
        return data.files.every(file => {
            const extension = file.originalname.split('.').pop().toLowerCase();
            return file.size <= maxSize && allowedTypes.includes(extension);
        });
    }

    getErrorMessage() {
        return 'Invalid image file size or type';
    }
}

/**
 * Event Manager implementing Observer Pattern
 * Demonstrates: Observer Pattern
 */
class EventManager {
    #observers = {};

    subscribe(event, observer) {
        if (!this.#observers[event]) {
            this.#observers[event] = [];
        }
        this.#observers[event].push(observer);
    }

    notify(event, data) {
        if (this.#observers[event]) {
            this.#observers[event].forEach(observer => {
                try {
                    observer.update(event, data);
                } catch (error) {
                    console.error(`Error notifying observer for event ${event}:`, error);
                }
            });
        }
    }
}

class FlatUpdateObserver {
    update(event, data) {
        console.log(`Flat Update Observer: ${event} occurred for flat ${data.flatId}`);
        // Could trigger notifications, logging, analytics, etc.
    }
}

/**
 * Flat Decorator for adding functionality
 * Demonstrates: Decorator Pattern
 */
class FlatDecorator {
    constructor(flat) {
        this.flat = flat;
    }

    // Delegate all calls to the wrapped flat
    getId() { return this.flat.getId(); }
    getUserId() { return this.flat.getUserId(); }
    getTitle() { return this.flat.getTitle(); }
    getDescription() { return this.flat.getDescription(); }
    isVacant() { return this.flat.isVacant(); }
    getInspectionDate() { return this.flat.getInspectionDate(); }
    getImages() { return this.flat.getImages(); }
    getTenantDetails() { return this.flat.getTenantDetails(); }
    calculateValue() { return this.flat.calculateValue(); }
    validate() { return this.flat.validate(); }
    toJSON() { return this.flat.toJSON(); }
}

class FlatWithMetricsDecorator extends FlatDecorator {
    constructor(flat) {
        super(flat);
        this.metrics = {
            viewCount: 0,
            lastViewed: null,
            inquiryCount: 0
        };
    }

    incrementViewCount() {
        this.metrics.viewCount++;
        this.metrics.lastViewed = new Date();
    }

    getMetrics() {
        return {...this.metrics};
    }

    toJSON() {
        return {
            ...super.toJSON(),
            metrics: this.metrics
        };
    }
}

module.exports = {
    BaseProperty,
    EnhancedFlat,
    BaseUser,
    AdminUser,
    PropertyManagerUser,
    ConfigManager,
    UserFactory,
    SortStrategy,
    DateSortStrategy,
    TitleSortStrategy,
    ValueSortStrategy,
    VacancySortStrategy,
    FlatSorter,
    ValidationHandler,
    TitleValidationHandler,
    ImageValidationHandler,
    EventManager,
    FlatUpdateObserver,
    FlatDecorator,
    FlatWithMetricsDecorator
};