
import React, { useEffect, useState } from 'react';
import { apiClient } from './api';

interface Channel {
  _id: string;
  name: string;
}

interface ChannelListProps {
  onSelectChannel: (channelId: string) => void;
}

const ChannelList: React.FC<ChannelListProps> = ({ onSelectChannel }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [newChannelName, setNewChannelName] = useState('');

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await apiClient.get('/api/channels');
        setChannels(response.data);
      } catch (error) {
        console.error('Error fetching channels:', error);
      }
    };

    fetchChannels();
  }, []);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      const response = await apiClient.post('/api/channels', { name: newChannelName });
      setChannels([...channels, response.data]);
      setNewChannelName('');
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  return (
    <div className="w-1/4 bg-gray-800 text-white p-4">
      <h2 className="text-xl font-bold mb-4">Channels</h2>
      <ul>
        {channels.map(channel => (
          <li key={channel._id} onClick={() => onSelectChannel(channel._id)} className="cursor-pointer hover:bg-gray-700 p-2 rounded">
            {channel.name}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <input
          type="text"
          value={newChannelName}
          onChange={(e) => setNewChannelName(e.target.value)}
          placeholder="New channel name"
          className="w-full p-2 rounded bg-gray-700 border border-gray-600"
        />
        <button onClick={handleCreateChannel} className="w-full mt-2 p-2 rounded bg-blue-600 hover:bg-blue-700">
          Create Channel
        </button>
      </div>
    </div>
  );
};

export default ChannelList;
