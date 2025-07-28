import React, { useState } from 'react';
import Avatar from './Avatar';

interface User {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
}

interface SettingsProps {
  user: User;
  onClose: () => void;
  onUserUpdate: (updatedUser: User) => void;
}

const Settings: React.FC<SettingsProps> = ({ user, onClose, onUserUpdate }) => {
  const [formData, setFormData] = useState({
    nickname: user.nickname || '',
    email: user.email || '',
    avatar: user.avatar || ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldSuccessMessages, setFieldSuccessMessages] = useState<{ [key: string]: string }>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const oldValue = formData[name as keyof typeof formData];
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Clear field success message when user starts typing
    if (fieldSuccessMessages[name]) {
      setFieldSuccessMessages(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Show success message if value changed from original
    if (value !== oldValue && value.trim() !== '') {
      const originalValue = name === 'nickname' ? user.nickname : user.email;
      if (value !== originalValue) {
        const fieldName = name === 'nickname' ? 'Display Name' : 'Email Address';
        setFieldSuccessMessages(prev => ({
          ...prev,
          [name]: `${fieldName} changed - click "Confirm Changes" to save`
        }));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.nickname.trim()) {
      newErrors.nickname = 'Nickname is required';
    } else if (formData.nickname.length > 50) {
      newErrors.nickname = 'Nickname must be 50 characters or less';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('Making request to /api/auth/profile with token:', token.substring(0, 20) + '...');
      console.log('Form data being sent:', {
        ...formData,
        avatar: formData.avatar ? `[${formData.avatar.length} characters]` : 'undefined'
      });

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text);
        throw new Error(`Server returned HTML instead of JSON. This usually means the API endpoint was not found or there's an authentication issue.`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update user in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Call the callback to update the parent component
      onUserUpdate(data.user);
      
      setSuccessMessage('Profile updated successfully!');
      
      // Close settings after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Profile update error:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to update profile'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({
          ...prev,
          avatar: 'Avatar image must be less than 5MB'
        }));
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({
          ...prev,
          avatar: 'Please select an image file'
        }));
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setFormData(prev => ({
          ...prev,
          avatar: base64String
        }));
        
        // Clear avatar error
        if (errors.avatar) {
          setErrors(prev => ({
            ...prev,
            avatar: ''
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearAvatar = () => {
    setFormData(prev => ({
      ...prev,
      avatar: ''
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-panel rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-fg">Settings</h2>
            <button
              onClick={onClose}
              className="text-fg-alt hover:text-fg transition-colors"
              aria-label="Close settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg">
              {successMessage}
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
              {errors.submit}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Section */}
            <div className="text-center">
              <div className="mb-4">
                <Avatar 
                  user={{
                    email: formData.email,
                    nickname: formData.nickname,
                    avatar: formData.avatar
                  }} 
                  size="lg" 
                />
              </div>
              
              <div className="space-y-2">
                <label className="block">
                  <span className="sr-only">Choose avatar</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="block w-full text-sm text-fg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent file:text-accentFore hover:file:bg-accent hover:file:opacity-90 file:cursor-pointer file:transition-all bg-panelAlt border border-border rounded-lg"
                  />
                </label>
                
                {formData.avatar && (
                  <button
                    type="button"
                    onClick={clearAvatar}
                    className="text-sm text-accent hover:underline"
                  >
                    Remove Avatar
                  </button>
                )}
                
                {errors.avatar && (
                  <p className="text-red-500 text-sm">{errors.avatar}</p>
                )}
              </div>
            </div>

            {/* Nickname Field */}
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-fg mb-2">
                Display Name
              </label>
              <input
                type="text"
                id="nickname"
                name="nickname"
                value={formData.nickname}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 bg-panelAlt border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent ${
                  errors.nickname ? 'border-red-500' : 'border-border'
                } text-fg`}
                placeholder="Enter your display name"
                maxLength={50}
              />
              {errors.nickname && (
                <p className="text-red-500 text-sm mt-1">{errors.nickname}</p>
              )}
              {fieldSuccessMessages.nickname && (
                <p className="text-green-500 text-sm mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {fieldSuccessMessages.nickname}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-fg mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 bg-panelAlt border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent ${
                  errors.email ? 'border-red-500' : 'border-border'
                } text-fg`}
                placeholder="Enter your email address"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
              {fieldSuccessMessages.email && (
                <p className="text-green-500 text-sm mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {fieldSuccessMessages.email}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-fg opacity-70 border border-border rounded-lg hover:bg-panelAlt hover:opacity-100 transition-all"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-accent text-accentFore rounded-lg hover:bg-accent hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : 'Confirm Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
