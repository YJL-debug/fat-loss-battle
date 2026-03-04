import { useState } from 'react';

const EMOJI_GROUPS = [
  { label: '动物', emojis: ['🐱', '🐶', '🐼', '🦊', '🐰', '🐸', '🐵', '🦁', '🐯', '🐻'] },
  { label: '运动', emojis: ['💪', '🏃', '🧘', '🏋️', '🚴', '🤸', '⚡', '🔥', '🎯', '🏆'] },
  { label: '趣味', emojis: ['😎', '🤓', '🥳', '🦸', '🧙', '👻', '🤖', '🎭', '🌟', '✨'] },
  { label: '食物', emojis: ['🥑', '🥦', '🍎', '🥗', '🍳', '🥤', '🍕', '🌮', '🍩', '🧁'] },
];

export default function AvatarPicker({ currentAvatar, onSelect, onClose }: {
  currentAvatar?: string | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(currentAvatar || '');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">选择头像</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>

        {EMOJI_GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="text-xs text-gray-400 mb-2">{group.label}</p>
            <div className="grid grid-cols-10 gap-1">
              {group.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setSelected(emoji)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition ${
                    selected === emoji ? 'bg-primary-100 ring-2 ring-primary-400' : 'hover:bg-gray-100'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={() => { if (selected) onSelect(selected); }}
          disabled={!selected}
          className="w-full mt-2 py-3 bg-primary-600 text-white rounded-xl font-medium disabled:opacity-50 transition"
        >
          确认选择
        </button>
      </div>
    </div>
  );
}
