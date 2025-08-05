import React, { useState } from 'react';
import GroupMemberList from './GroupMemberList';
import GroupInviteModal from './GroupInviteModal';

interface User {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
}

interface Group {
  _id: string;
  name: string;
  description?: string;
  members: string[];
  admins: string[];
  creator: string;
  avatar?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  currentUser: User;
  onGroupUpdated: (group: Group) => void;
  onGroupDeleted: (groupId: string) => void;
}

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  isOpen,
  onClose,
  group,
  currentUser,
  onGroupUpdated,
  onGroupDeleted
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'members'>('info');
  const [groupName, setGroupName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [isPrivate, setIsPrivate] = useState(group.isPrivate);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isCurrentUserAdmin = group.admins.includes(currentUser.email);
  const isCurrentUserCreator = group.creator === currentUser.email;

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCurrentUserAdmin) {
      setError('Only group admins can update group settings');
      return;
    }

    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${group._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: description.trim() || undefined,
          isPrivate
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update group');
      }

      const result = await response.json();
      onGroupUpdated(result.data);
      setSuccess('Group updated successfully');
    } catch (error) {
      console.error('Error updating group:', error);
      setError(error instanceof Error ? error.message : 'Failed to update group');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!isCurrentUserCreator) {
      setError('Only the group creator can delete the group');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${group._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete group');
      }

      onGroupDeleted(group._id);
      onClose();
    } catch (error) {
      console.error('Error deleting group:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete group');
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleMemberAdded = (memberEmail: string) => {
    // Update local group state to include new member
    const updatedGroup = {
      ...group,
      members: [...group.members, memberEmail]
    };
    onGroupUpdated(updatedGroup);
  };

  const handleMemberRemoved = (memberEmail: string) => {
    // Update local group state to remove member
    const updatedGroup = {
      ...group,
      members: group.members.filter(email => email !== memberEmail),
      admins: group.admins.filter(email => email !== memberEmail)
    };
    onGroupUpdated(updatedGroup);
  };

  const handleMemberRoleChanged = (memberEmail: string, role: 'admin' | 'member') => {
    // Update local group state
    const updatedGroup = {
      ...group,
      admins: role === 'admin' 
        ? [...group.admins.filter(email => email !== memberEmail), memberEmail]
        : group.admins.filter(email => email !== memberEmail)
    };
    onGroupUpdated(updatedGroup);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-panel border border-border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-lg font-semibold text-fg">Group Settings - {group.name}</h3>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-muted hover:text-fg transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'info'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-muted hover:text-fg'
              }`}
            >
              Group Info
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'members'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-muted hover:text-fg'
              }`}
            >
              Members ({group.members.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                {success}
              </div>
            )}

            {activeTab === 'info' && (
              <form onSubmit={handleUpdateGroup} className="space-y-4">
                <div>
                  <label htmlFor="groupName" className="block text-sm font-medium text-fg mb-2">
                    Group Name
                  </label>
                  <input
                    type="text"
                    id="groupName"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-input text-fg 
                      placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
                    disabled={!isCurrentUserAdmin || isLoading}
                    maxLength={100}
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-fg mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-input text-fg 
                      placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    disabled={!isCurrentUserAdmin || isLoading}
                    maxLength={500}
                    rows={3}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="h-4 w-4 text-accent focus:ring-accent border-border rounded"
                    disabled={!isCurrentUserAdmin || isLoading}
                  />
                  <label htmlFor="isPrivate" className="ml-2 block text-sm text-fg">
                    Private Group
                  </label>
                </div>

                <div className="bg-panelAlt p-3 rounded-md">
                  <h4 className="text-sm font-medium text-fg mb-2">Group Information</h4>
                  <div className="text-xs text-muted space-y-1">
                    <div>Created: {new Date(group.createdAt).toLocaleDateString()}</div>
                    <div>Creator: {group.creator}</div>
                    <div>Members: {group.members.length}</div>
                    <div>Admins: {group.admins.length}</div>
                  </div>
                </div>

                {isCurrentUserAdmin && (
                  <div className="flex justify-between pt-4">
                    <div>
                      {isCurrentUserCreator && (
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={isLoading}
                          className="px-4 py-2 text-sm bg-red-600 text-white rounded-md 
                            hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          Delete Group
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 text-sm bg-accent text-accentFore rounded-md 
                        hover:bg-accentAlt transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Updating...' : 'Update Group'}
                    </button>
                  </div>
                )}
              </form>
            )}

            {activeTab === 'members' && (
              <div className="space-y-4">
                {isCurrentUserAdmin && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-4 py-2 text-sm bg-accent text-accentFore rounded-md 
                        hover:bg-accentAlt transition-colors"
                    >
                      Add Member
                    </button>
                  </div>
                )}
                
                <GroupMemberList
                  group={group}
                  currentUser={currentUser}
                  onMemberRemoved={handleMemberRemoved}
                  onMemberRoleChanged={handleMemberRoleChanged}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-panel border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-fg mb-4">Delete Group</h3>
              <p className="text-muted mb-4">
                Are you sure you want to delete "{group.name}"? This action cannot be undone.
                All group messages and data will be permanently lost.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm text-muted hover:text-fg border border-border 
                    rounded-md hover:bg-panelAlt transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteGroup}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md 
                    hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Deleting...' : 'Delete Group'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <GroupInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        group={group}
        currentUser={currentUser}
        onMemberAdded={handleMemberAdded}
      />
    </>
  );
};

export default GroupSettingsModal;