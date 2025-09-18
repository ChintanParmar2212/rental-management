// ===================================
// STEP 2: Update your existing flatController.js
// File: backend/controllers/flatController.js (REPLACE YOUR EXISTING FILE)
// ===================================

const Flat = require('../models/Flat');
const {
    EnhancedFlat,
    UserFactory,
    FlatSorter,
    ConfigManager,
    ValidationHandler,
    TitleValidationHandler,
    ImageValidationHandler,
    EventManager,
    FlatUpdateObserver,
    FlatWithMetricsDecorator
} = require('./BaseClasses');

// Initialize singletons and observers
const config = ConfigManager.getInstance();
const eventManager = new EventManager();
eventManager.subscribe('flat_created', new FlatUpdateObserver());
eventManager.subscribe('flat_updated', new FlatUpdateObserver());
eventManager.subscribe('flat_deleted', new FlatUpdateObserver());

// Setup validation chain
const validationChain = new TitleValidationHandler();
validationChain.setNext(new ImageValidationHandler());

/**
 * Enhanced Flat Controller using OOP and Design Patterns
 * Demonstrates: Integration of all patterns in existing structure
 */

const getFlats = async (req, res) => {
    try {
        // Create user object using Factory Pattern
        const user = UserFactory.createUserFromRequest(req);
        
        // Get flats from database
        const mongoFlats = await Flat.find({ userId: user.getId() });
        
        // Convert to Enhanced Flat objects (Inheritance + Polymorphism)
        const enhancedFlats = mongoFlats.map(doc => EnhancedFlat.fromDocument(doc));
        
        // Apply sorting strategy (Strategy Pattern)
        const sortBy = req.query.sortBy || 'date';
        const sorter = FlatSorter.createSorter(sortBy);
        const sortedFlats = sorter.sort(enhancedFlats);
        
        // Apply decorator for metrics (Decorator Pattern)
        const decoratedFlats = sortedFlats.map(flat => {
            const decorated = new FlatWithMetricsDecorator(flat);
            decorated.incrementViewCount(); // Track view
            return decorated;
        });
        
        // Convert back to JSON for response
        const responseData = decoratedFlats.map(flat => flat.toJSON());
        
        res.json(responseData);
    } catch (error) {
        console.error('Error in getFlats:', error);
        res.status(500).json({ 
            message: 'Error retrieving flats', 
            error: error.message 
        });
    }
};

const addFlat = async (req, res) => {
    const { title, description, inspectionDate } = req.body;
    console.log('Add Flat called with:', { title, description, inspectionDate, userId: req.user?.id });
    console.log('Files received:', req.files);

    try {
        // Create user object using Factory Pattern
        const user = UserFactory.createUserFromRequest(req);
        
        // Validate using Chain of Responsibility Pattern
        const validationData = { title, description, files: req.files };
        const validationResult = validationChain.handle(validationData);
        
        if (!validationResult.success) {
            return res.status(400).json({ message: validationResult.message });
        }
        
        // Process uploaded images using Singleton config
        const images = req.files ? req.files.map(file => file.filename) : [];
        console.log('Images to save:', images);
        
        // Create Enhanced Flat object (Inheritance + Polymorphism)
        const flatData = { title, description, inspectionDate, images };
        const enhancedFlat = new EnhancedFlat(user.getId(), flatData);
        
        // Validate using OOP method (Polymorphism)
        enhancedFlat.validate();
        
        // Save to database
        const savedFlat = await Flat.create(enhancedFlat.toJSON());
        console.log('Flat created:', savedFlat);
        
        // Notify observers (Observer Pattern)
        eventManager.notify('flat_created', { 
            flatId: savedFlat._id, 
            userId: user.getId() 
        });
        
        res.status(201).json(savedFlat);
    } catch (error) {
        console.error('Error creating flat:', error);
        
        if (error.message.includes('required') || error.message.includes('characters')) {
            res.status(400).json({ message: error.message });
        } else {
            res.status(500).json({ message: error.message });
        }
    }
};

const updateFlat = async (req, res) => {
    const { title, description, vacant, inspectionDate, tenantDetails } = req.body;
    console.log('Update Flat called with:', { title, description, vacant, inspectionDate, tenantDetails });
    console.log('Files received for update:', req.files);
    
    try {
        // Create user object using Factory Pattern
        const user = UserFactory.createUserFromRequest(req);
        
        // Get existing flat from database
        const existingDoc = await Flat.findById(req.params.id);
        if (!existingDoc) {
            return res.status(404).json({ message: 'Flat not found' });
        }
        
        // Convert to Enhanced Flat (Inheritance)
        const enhancedFlat = EnhancedFlat.fromDocument(existingDoc);
        
        // Check permissions using polymorphic method
        if (!user.canAccessFlat(enhancedFlat)) {
            return res.status(403).json({ message: 'Not authorized to update this flat' });
        }
        
        // Update properties using OOP methods (Encapsulation)
        if (title) enhancedFlat.setTitle(title);
        if (description !== undefined) enhancedFlat.setDescription(description);
        if (vacant !== undefined) enhancedFlat.setVacant(vacant);
        if (tenantDetails) enhancedFlat.setTenantDetails(tenantDetails);
        
        // Process new images
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.filename);
            console.log('New images to add:', newImages);
            newImages.forEach(url => enhancedFlat.addImage(url));
        }
        
        // Validate using polymorphic method
        enhancedFlat.validate();
        
        // Update in database
        const updateData = enhancedFlat.toJSON();
        const updatedFlat = await Flat.findByIdAndUpdate(req.params.id, updateData, { new: true });
        
        console.log('Flat updated:', updatedFlat);
        
        // Notify observers (Observer Pattern)
        eventManager.notify('flat_updated', { 
            flatId: req.params.id, 
            userId: user.getId() 
        });
        
        res.json(updatedFlat);
    } catch (error) {
        console.error('Error updating flat:', error);
        
        if (error.message.includes('required') || error.message.includes('characters')) {
            res.status(400).json({ message: error.message });
        } else {
            res.status(500).json({ message: error.message });
        }
    }
};

const deleteFlat = async (req, res) => {
    try {
        // Create user object using Factory Pattern
        const user = UserFactory.createUserFromRequest(req);
        
        // Get existing flat
        const existingDoc = await Flat.findById(req.params.id);
        if (!existingDoc) {
            return res.status(404).json({ message: 'Flat not found' });
        }
        
        // Convert to Enhanced Flat for permission checking
        const enhancedFlat = EnhancedFlat.fromDocument(existingDoc);
        
        // Check permissions using polymorphic method
        if (!user.canAccessFlat(enhancedFlat)) {
            return res.status(403).json({ message: 'Not authorized to delete this flat' });
        }
        
        await Flat.findByIdAndDelete(req.params.id);
        
        // Notify observers (Observer Pattern)
        eventManager.notify('flat_deleted', { 
            flatId: req.params.id, 
            userId: user.getId() 
        });
        
        res.json({ message: 'Flat deleted' });
    } catch (error) {
        console.error('Error deleting flat:', error);
        res.status(500).json({ message: error.message });
    }
};

const deleteImage = async (req, res) => {
    try {
        const { id, imageName } = req.params;
        console.log('Deleting image:', imageName, 'from flat:', id);
        
        // Create user object using Factory Pattern
        const user = UserFactory.createUserFromRequest(req);
        
        const existingDoc = await Flat.findById(id);
        if (!existingDoc) {
            return res.status(404).json({ message: 'Flat not found' });
        }
        
        // Convert to Enhanced Flat
        const enhancedFlat = EnhancedFlat.fromDocument(existingDoc);
        
        // Check permissions
        if (!user.canAccessFlat(enhancedFlat)) {
            return res.status(403).json({ message: 'Not authorized to delete this image' });
        }
        
        // Remove image using OOP method
        enhancedFlat.removeImage(imageName);
        
        // Update in database
        await Flat.findByIdAndUpdate(id, enhancedFlat.toJSON());
        
        // Delete physical file
        const fs = require('fs');
        const path = require('path');
        const imagePath = path.join(__dirname, '../uploads/flats', imageName);
        
        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error('Error deleting image file:', err);
            } else {
                console.log('Image file deleted successfully:', imagePath);
            }
        });
        
        res.json({ message: 'Image deleted successfully', flat: enhancedFlat.toJSON() });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ message: error.message });
    }
};

const getPublicFlats = async (req, res) => {
    try {
        // Get all flats
        const flats = await Flat.find()
            .populate('userId', 'name email') 
            .sort({ createdAt: -1 });
        
        // Convert to Enhanced Flat objects and apply sorting if requested
        const enhancedFlats = flats.map(doc => EnhancedFlat.fromDocument(doc));
        
        // Apply sorting strategy if requested
        const sortBy = req.query.sortBy;
        if (sortBy) {
            const sorter = FlatSorter.createSorter(sortBy);
            const sortedFlats = sorter.sort(enhancedFlats);
            return res.json(sortedFlats.map(flat => flat.toJSON()));
        }
        
        res.json(enhancedFlats.map(flat => flat.toJSON()));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// tenant crud

// Add tenant 
const addTenant = async (req, res) => {
    const { flatId } = req.params;
    const { name, email, phone, moveInDate, rentAmount } = req.body;
    
    console.log('Add Tenant called with:', { flatId, name, email, phone, moveInDate, rentAmount });
    
    if (!name) {
        return res.status(400).json({ message: 'Tenant name is required' });
    }
    
    try {
        const flat = await Flat.findById(flatId);
        if (!flat) {
            return res.status(404).json({ message: 'Flat not found' });
        }
        
        // Check if user owns this flat
        if (flat.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to add tenant to this flat' });
        }
        
        // Check if flat already has a tenant
        if (!flat.vacant && flat.tenantDetails) {
            return res.status(400).json({ message: 'Flat already has a tenant. Update existing tenant or mark flat as vacant first.' });
        }
        //
        const tenantData = {
            name,
            email,
            phone,
            moveInDate,
            rentAmount: rentAmount ? Number(rentAmount) : null
        };
        
        flat.tenantDetails = tenantData;
        flat.vacant = false;
        
        const updatedFlat = await flat.save();
        console.log('Tenant added to flat:', updatedFlat);
        
        res.status(201).json({
            message: 'Tenant added successfully',
            flat: updatedFlat,
            tenant: tenantData
        });
    } catch (error) {
        console.error('Error adding tenant:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get tenant details
const getTenant = async (req, res) => {
    const { flatId } = req.params;
    
    try {
        const flat = await Flat.findById(flatId);
        if (!flat) {
            return res.status(404).json({ message: 'Flat not found' });
        }
        
        // Check if user owns this flat
        if (flat.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to view tenant details for this flat' });
        }
        
        if (!flat.tenantDetails) {
            return res.status(404).json({ message: 'No tenant found for this flat' });
        }
        
        res.json({
            flatId: flat._id,
            flatTitle: flat.title,
            tenant: flat.tenantDetails,
            vacant: flat.vacant
        });
    } catch (error) {
        console.error('Error getting tenant:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update tenant details
const updateTenant = async (req, res) => {
    const { flatId } = req.params;
    const { name, email, phone, moveInDate, rentAmount } = req.body;
    
    console.log('Update Tenant called with:', { flatId, name, email, phone, moveInDate, rentAmount });
    
    try {
        const flat = await Flat.findById(flatId);
        if (!flat) {
            return res.status(404).json({ message: 'Flat not found' });
        }
        
        // Check if user owns this flat
        if (flat.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to update tenant for this flat' });
        }
        
        if (!flat.tenantDetails) {
            return res.status(404).json({ message: 'No tenant found for this flat to update' });
        }
        
        // Update tenant details
        if (name !== undefined) flat.tenantDetails.name = name;
        if (email !== undefined) flat.tenantDetails.email = email;
        if (phone !== undefined) flat.tenantDetails.phone = phone;
        if (moveInDate !== undefined) flat.tenantDetails.moveInDate = moveInDate;
        if (rentAmount !== undefined) flat.tenantDetails.rentAmount = rentAmount ? Number(rentAmount) : null;
        
        const updatedFlat = await flat.save();
        console.log('Tenant updated:', updatedFlat.tenantDetails);
        
        res.json({
            message: 'Tenant updated successfully',
            flat: updatedFlat,
            tenant: updatedFlat.tenantDetails
        });
    } catch (error) {
        console.error('Error updating tenant:', error);
        res.status(500).json({ message: error.message });
    }
};

// Remove tenant - mark vacant
const removeTenant = async (req, res) => {
    const { flatId } = req.params;
    
    console.log('Remove Tenant called for flatId:', flatId);
    
    try {
        const flat = await Flat.findById(flatId);
        if (!flat) {
            return res.status(404).json({ message: 'Flat not found' });
        }
        
        // Check if user owns this flat
        if (flat.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to remove tenant from this flat' });
        }
        
        if (!flat.tenantDetails) {
            return res.status(404).json({ message: 'No tenant found for this flat' });
        }
        
        const removedTenant = { ...flat.tenantDetails };
        flat.tenantDetails = null;
        flat.vacant = true;
        
        const updatedFlat = await flat.save();
        console.log('Tenant removed from flat:', updatedFlat);
        
        res.json({
            message: 'Tenant removed successfully',
            flat: updatedFlat,
            removedTenant: removedTenant
        });
    } catch (error) {
        console.error('Error removing tenant:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get all tenants for user's flats
const getAllTenants = async (req, res) => {
    try {
        const flats = await Flat.find({ 
            userId: req.user.id,
            tenantDetails: { $exists: true, $ne: null }
        });
        
        const tenants = flats.map(flat => ({
            flatId: flat._id,
            flatTitle: flat.title,
            tenant: flat.tenantDetails,
            vacant: flat.vacant
        }));
        
        res.json({
            message: 'Tenants retrieved successfully',
            count: tenants.length,
            tenants: tenants
        });
    } catch (error) {
        console.error('Error getting all tenants:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getFlats, 
    addFlat, 
    updateFlat, 
    deleteFlat, 
    deleteImage, 
    getPublicFlats,
    addTenant,
    getTenant,
    updateTenant,
    removeTenant,
    getAllTenants
};
