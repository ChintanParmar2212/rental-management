const Flat = require('../models/Flat');

// Existing flat operations
const getFlats = async (req, res) => {
    try {
        const flats = await Flat.find({ userId: req.user.id });
        res.json(flats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addFlat = async (req, res) => {
    const { title, description, inspectionDate } = req.body;
    console.log('Add Flat called with:', { title, description, inspectionDate, userId: req.user?.id });
    console.log('Files received:', req.files);

    if (!title) {
        return res.status(400).json({ message: 'Title is required' });
    }

    try {
        const images = req.files ? req.files.map(file => file.filename) : [];
        console.log('Images to save:', images);
        
        const flat = await Flat.create({ 
            userId: req.user.id, 
            title, 
            description, 
            inspectionDate,
            images 
        });
        console.log('Flat created:', flat);
        res.status(201).json(flat);
    } catch (error) {
        console.error('Error creating flat:', error);
        res.status(500).json({ message: error.message });
    }
};

const updateFlat = async (req, res) => {
    const { title, description, vacant, inspectionDate, tenantDetails } = req.body;
    console.log('Update Flat called with:', { title, description, vacant, inspectionDate, tenantDetails });
    console.log('Files received for update:', req.files);
    
    try {
        const flat = await Flat.findById(req.params.id);
        if (!flat) return res.status(404).json({ message: 'Flat not found' });
        
        // Check if user owns this flat
        if (flat.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to update this flat' });
        }
        
        // Update text fields
        flat.title = title || flat.title;
        flat.description = description || flat.description;
        flat.vacant = vacant ?? flat.vacant;
        flat.inspectionDate = inspectionDate || flat.inspectionDate;
        
        // Handle tenant details
        if (tenantDetails !== undefined) {
            flat.tenantDetails = tenantDetails;
        }
        
        // Handle images
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.filename);
            console.log('New images to add:', newImages);
            flat.images = [...(flat.images || []), ...newImages];
        }
        
        const updatedFlat = await flat.save();
        console.log('Flat updated:', updatedFlat);
        res.json(updatedFlat);
    } catch (error) {
        console.error('Error updating flat:', error);
        res.status(500).json({ message: error.message });
    }
};

const deleteFlat = async (req, res) => {
    try {
        const flat = await Flat.findById(req.params.id);
        if (!flat) return res.status(404).json({ message: 'Flat not found' });
        
        // Check if user owns this flat
        if (flat.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this flat' });
        }
        
        await flat.remove();
        res.json({ message: 'Flat deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteImage = async (req, res) => {
    try {
        const { id, imageName } = req.params;
        console.log('Deleting image:', imageName, 'from flat:', id);
        
        const flat = await Flat.findById(id);
        if (!flat) {
            return res.status(404).json({ message: 'Flat not found' });
        }
        
        // Check if user owns this flat
        if (flat.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this image' });
        }
        
        // Remove image from flat's images array
        flat.images = flat.images.filter(img => img !== imageName);
        await flat.save();
        
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
        
        res.json({ message: 'Image deleted successfully', flat });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ message: error.message });
    }
};

const getPublicFlats = async (req, res) => {
    try {
        const flats = await Flat.find()
            .populate('userId', 'name email') 
            .sort({ createdAt: -1 }); 
        res.json(flats);
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