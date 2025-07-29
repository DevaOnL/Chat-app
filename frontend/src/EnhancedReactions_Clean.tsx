import React, { useState, useRef, useEffect } from 'react';
import './reactions.css';

interface ReactionTooltipProps {
  emoji: string;
  userIds: string[];
  users: Array<{ id: string; nickname: string; email: string }>;
  onToggle: () => void;
  currentUserId: string;
}

export const ReactionTooltip: React.FC<ReactionTooltipProps> = ({
  emoji,
  userIds,
  users,
  onToggle,
  currentUserId
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const reactedUsers = userIds.map(id => 
    users.find(u => u.id === id) || { id, nickname: id, email: id }
  );

  const hasUserReacted = userIds.includes(currentUserId);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border transition-all duration-200 transform hover:scale-105 reaction-button ${
          hasUserReacted
            ? 'bg-accent text-accentFore border-accent shadow-sm reaction-pulse'
            : 'bg-panel border-border hover:bg-panelAlt hover:border-accent/50'
        }`}
      >
        <span className="text-sm">{emoji}</span>
        <span className="text-xs font-medium">{userIds.length}</span>
      </button>
      
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-panel border border-border rounded-lg shadow-lg p-2 z-50 min-w-max reaction-tooltip"
        >
          <div className="text-xs text-fg">
            <div className="font-medium mb-1 flex items-center gap-1">
              <span className="text-sm">{emoji}</span>
              <span>Reacted by:</span>
            </div>
            <div className="space-y-1">
              {reactedUsers.map((user, index) => (
                <div key={user.id} className="flex items-center justify-between">
                  <span className={user.id === currentUserId ? 'font-medium text-accent' : ''}>
                    {user.nickname}
                  </span>
                  {user.id === currentUserId && (
                    <span className="text-xs text-accent ml-2">(You)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border"></div>
        </div>
      )}
    </div>
  );
};

interface QuickReactionsProps {
  onReact: (emoji: string) => void;
  messageId: string;
  existingReactions?: { [emoji: string]: string[] };
  currentUserId: string;
}

export const QuickReactions: React.FC<QuickReactionsProps> = ({
  onReact,
  messageId,
  existingReactions = {},
  currentUserId
}) => {
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  
  return (
    <div className="flex gap-0.5 quick-reactions-container">
      {quickEmojis.map((emoji) => {
        const hasReacted = existingReactions[emoji]?.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            className={`p-1 rounded-full transition-all duration-200 hover:scale-110 text-sm ${
              hasReacted
                ? 'bg-accent text-accentFore'
                : 'hover:bg-panelAlt bg-panel/80 backdrop-blur-sm border border-border/50'
            }`}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
};

interface EmojiData {
  emoji: string;
  name: string;
  keywords: string[];
}

interface EmojiCategory {
  name: string;
  emojis: EmojiData[];
}

interface EnhancedEmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
}

export const EnhancedEmojiPicker: React.FC<EnhancedEmojiPickerProps> = ({
  onEmojiSelect,
  onClose,
  position = 'bottom'
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  const categories: EmojiCategory[] = [
    {
      name: 'Frequently Used',
      emojis: [
        { emoji: '👍', name: 'thumbs up', keywords: ['like', 'approve', 'good', 'yes', 'positive'] },
        { emoji: '👎', name: 'thumbs down', keywords: ['dislike', 'disapprove', 'bad', 'no', 'negative'] },
        { emoji: '❤️', name: 'red heart', keywords: ['love', 'heart', 'emotion', 'red'] },
        { emoji: '😂', name: 'face with tears of joy', keywords: ['laugh', 'crying', 'funny', 'joy', 'lol'] },
        { emoji: '😮', name: 'face with open mouth', keywords: ['surprise', 'amazed', 'shocked', 'wow'] },
        { emoji: '😢', name: 'crying face', keywords: ['sad', 'cry', 'tear', 'sorrow', 'upset'] },
        { emoji: '😡', name: 'pouting face', keywords: ['angry', 'mad', 'annoyed', 'furious'] },
        { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause', 'praise', 'congrats'] },
        { emoji: '🎉', name: 'party popper', keywords: ['celebration', 'party', 'congratulations', 'hooray'] },
        { emoji: '🔥', name: 'fire', keywords: ['hot', 'burn', 'flame', 'lit', 'awesome'] },
        { emoji: '⭐', name: 'star', keywords: ['star', 'favorite', 'good', 'excellent'] },
        { emoji: '💯', name: 'hundred points', keywords: ['perfect', 'score', 'excellent', 'complete'] }
      ]
    },
    {
      name: 'Smileys',
      emojis: [
        { emoji: '😀', name: 'grinning face', keywords: ['happy', 'smile', 'grin', 'joy'] },
        { emoji: '😃', name: 'grinning face with big eyes', keywords: ['happy', 'smile', 'joy', 'cheerful'] },
        { emoji: '😄', name: 'grinning face with smiling eyes', keywords: ['happy', 'smile', 'joy', 'laugh'] },
        { emoji: '😁', name: 'beaming face with smiling eyes', keywords: ['happy', 'smile', 'grin'] },
        { emoji: '😆', name: 'grinning squinting face', keywords: ['laugh', 'happy', 'smile', 'giggle'] },
        { emoji: '😅', name: 'grinning face with sweat', keywords: ['laugh', 'nervous', 'sweat', 'relief'] },
        { emoji: '😂', name: 'face with tears of joy', keywords: ['laugh', 'crying', 'funny', 'joy', 'lol'] },
        { emoji: '🙂', name: 'slightly smiling face', keywords: ['smile', 'happy', 'content'] },
        { emoji: '😉', name: 'winking face', keywords: ['wink', 'flirt', 'playful'] },
        { emoji: '😊', name: 'smiling face with smiling eyes', keywords: ['happy', 'smile', 'blush'] },
        { emoji: '😇', name: 'smiling face with halo', keywords: ['angel', 'innocent', 'good'] },
        { emoji: '😋', name: 'face savoring food', keywords: ['delicious', 'yummy', 'tasty', 'tongue'] }
      ]
    },
    {
      name: 'Emotions',
      emojis: [
        { emoji: '😐', name: 'neutral face', keywords: ['neutral', 'blank', 'meh'] },
        { emoji: '😑', name: 'expressionless face', keywords: ['deadpan', 'expressionless', 'blank'] },
        { emoji: '😒', name: 'unamused face', keywords: ['unamused', 'annoyed', 'unimpressed'] },
        { emoji: '😔', name: 'pensive face', keywords: ['sad', 'thoughtful', 'pensive'] },
        { emoji: '😕', name: 'confused face', keywords: ['confused', 'disappointed', 'sad'] },
        { emoji: '😖', name: 'confounded face', keywords: ['confused', 'frustrated', 'upset'] },
        { emoji: '😞', name: 'disappointed face', keywords: ['disappointed', 'sad', 'upset'] },
        { emoji: '😟', name: 'worried face', keywords: ['worried', 'concerned', 'anxious'] },
        { emoji: '😠', name: 'angry face', keywords: ['angry', 'mad', 'annoyed'] },
        { emoji: '😡', name: 'pouting face', keywords: ['angry', 'mad', 'annoyed', 'furious'] },
        { emoji: '😢', name: 'crying face', keywords: ['sad', 'cry', 'tear', 'sorrow', 'upset'] },
        { emoji: '😭', name: 'loudly crying face', keywords: ['cry', 'sob', 'sad', 'tears'] }
      ]
    },
    {
      name: 'Gestures',
      emojis: [
        { emoji: '👋', name: 'waving hand', keywords: ['wave', 'hello', 'goodbye', 'hi'] },
        { emoji: '✋', name: 'raised hand', keywords: ['hand', 'stop', 'high five'] },
        { emoji: '👌', name: 'OK hand', keywords: ['ok', 'okay', 'perfect', 'good'] },
        { emoji: '✌️', name: 'victory hand', keywords: ['peace', 'victory', 'two'] },
        { emoji: '👍', name: 'thumbs up', keywords: ['like', 'approve', 'good', 'yes', 'positive'] },
        { emoji: '👎', name: 'thumbs down', keywords: ['dislike', 'disapprove', 'bad', 'no', 'negative'] },
        { emoji: '👊', name: 'oncoming fist', keywords: ['fist', 'punch', 'power'] },
        { emoji: '✊', name: 'raised fist', keywords: ['fist', 'power', 'solidarity'] },
        { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause', 'praise', 'congrats'] },
        { emoji: '🙌', name: 'raising hands', keywords: ['celebration', 'praise', 'hooray', 'hands up'] },
        { emoji: '🙏', name: 'folded hands', keywords: ['pray', 'thanks', 'please', 'gratitude'] },
        { emoji: '👐', name: 'open hands', keywords: ['open', 'hug', 'hands'] }
      ]
    },
    {
      name: 'Objects',
      emojis: [
        { emoji: '💯', name: 'hundred points', keywords: ['perfect', 'score', 'excellent', 'complete'] },
        { emoji: '💥', name: 'collision', keywords: ['boom', 'explosion', 'impact'] },
        { emoji: '💫', name: 'dizzy', keywords: ['dizzy', 'stars', 'sparkle'] },
        { emoji: '💬', name: 'speech balloon', keywords: ['talk', 'speech', 'comment', 'chat'] },
        { emoji: '💭', name: 'thought balloon', keywords: ['think', 'thought', 'idea'] },
        { emoji: '💤', name: 'zzz', keywords: ['sleep', 'tired', 'sleepy', 'snore'] },
        { emoji: '🔥', name: 'fire', keywords: ['hot', 'burn', 'flame', 'lit', 'awesome'] },
        { emoji: '⭐', name: 'star', keywords: ['star', 'favorite', 'good', 'excellent'] },
        { emoji: '🌟', name: 'glowing star', keywords: ['star', 'sparkle', 'shine', 'bright'] },
        { emoji: '✨', name: 'sparkles', keywords: ['sparkle', 'shine', 'glitter', 'magic'] },
        { emoji: '⚡', name: 'lightning', keywords: ['lightning', 'electric', 'fast', 'energy'] },
        { emoji: '🎯', name: 'direct hit', keywords: ['target', 'bullseye', 'goal', 'accurate'] }
      ]
    }
  ];

  const searchEmojis = (query: string): EmojiData[] => {
    if (!query.trim()) return [];
    
    const searchTerm = query.toLowerCase().trim();
    const allEmojis = categories.flatMap(cat => cat.emojis);
    
    return allEmojis.filter(emojiData => 
      emojiData.name.toLowerCase().includes(searchTerm) ||
      emojiData.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm))
    );
  };

  const filteredEmojis = search
    ? searchEmojis(search)
    : categories[selectedCategory]?.emojis || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className={`bg-panel border border-border rounded-lg shadow-xl w-72 emoji-picker-slide ${
        position === 'top' ? '' : ''
      }`}
    >
      {/* Search */}
      <div className="p-3 border-b border-border">
        <input
          type="text"
          placeholder="Search emojis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 bg-panelAlt border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg text-sm"
          autoFocus
        />
      </div>

      {!search && (
        <div className="flex border-b border-border overflow-x-auto">
          {categories.map((category, index) => (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(index)}
              className={`flex-shrink-0 px-2 py-2 text-xs transition-colors emoji-category-button whitespace-nowrap ${
                selectedCategory === index
                  ? 'bg-accent text-accentFore'
                  : 'text-fg hover:bg-panelAlt'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="p-3 max-h-64 overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {filteredEmojis.map((emojiData, index) => (
            <button
              key={`${emojiData.emoji}-${index}`}
              onClick={() => {
                onEmojiSelect(emojiData.emoji);
                onClose();
              }}
              className="text-xl p-2 rounded-lg hover:bg-panelAlt transition-colors flex items-center justify-center aspect-square emoji-grid-item"
              title={`${emojiData.emoji} ${emojiData.name}`}
            >
              {emojiData.emoji}
            </button>
          ))}
        </div>
        {filteredEmojis.length === 0 && (
          <div className="text-center text-gray-500 py-4 text-sm">
            {search ? 'No emojis found for your search' : 'No emojis found'}
          </div>
        )}
      </div>
    </div>
  );
};

interface ReactionBarProps {
  reactions: { [emoji: string]: string[] };
  users: Array<{ id: string; nickname: string; email: string }>;
  currentUserId: string;
  onToggleReaction: (emoji: string) => void;
  onShowEmojiPicker: () => void;
  showEmojiPicker: boolean;
  onCloseEmojiPicker: () => void;
}

export const ReactionBar: React.FC<ReactionBarProps> = ({
  reactions,
  users,
  currentUserId,
  onToggleReaction,
  onShowEmojiPicker,
  showEmojiPicker,
  onCloseEmojiPicker
}) => {
  const hasReactions = Object.keys(reactions).length > 0;

  return (
    <div className="mt-2 space-y-2">
      {/* Display existing reactions */}
      {hasReactions && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(reactions).map(([emoji, userIds]) => (
            <ReactionTooltip
              key={emoji}
              emoji={emoji}
              userIds={userIds}
              users={users}
              onToggle={() => onToggleReaction(emoji)}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={onShowEmojiPicker}
          className="text-xs px-3 py-1 rounded border border-border hover:bg-panelAlt transition-colors flex items-center gap-1 group"
          title="Add reaction"
        >
          <span className="transition-transform group-hover:scale-110">😊</span>
          <span>React</span>
        </button>

        {/* Enhanced emoji picker with better positioning */}
        {showEmojiPicker && (
          <div className="fixed inset-0 z-[9998] pointer-events-none">
            <div 
              className="absolute bottom-20 left-4 pointer-events-auto"
              style={{
                transform: 'translateY(0)'
              }}
            >
              <EnhancedEmojiPicker
                onEmojiSelect={onToggleReaction}
                onClose={onCloseEmojiPicker}
                position="top"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
