import { useState } from 'react';
import api from '../api';
import ConfirmDialog from '../components/ConfirmDialog';

interface OrphanedFile {
  filename: string;
  size: number;
  modifiedAt: string | null;
}

interface MediaItem {
  id: string;
  originalname: string;
  filename: string;
  size: number;
  type: string;
  createdAt: string;
  directLink: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

type Tab = 'orphaned' | 'large' | 'old';

export default function CleanupPage() {
  const [tab, setTab] = useState<Tab>('orphaned');
  const [orphaned, setOrphaned] = useState<OrphanedFile[]>([]);
  const [largeFiles, setLargeFiles] = useState<MediaItem[]>([]);
  const [oldFiles, setOldFiles] = useState<MediaItem[]>([]);
  const [selectedLarge, setSelectedLarge] = useState<Set<string>>(new Set());
  const [selectedOld, setSelectedOld] = useState<Set<string>>(new Set());
  const [threshold, setThreshold] = useState('10');
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [result, setResult] = useState('');

  const scanOrphaned = async () => {
    setLoading(true);
    setResult('');
    try {
      const res = await api.get('/cleanup/orphaned');
      setOrphaned(res.data);
    } finally {
      setLoading(false);
    }
  };

  const deleteOrphaned = async () => {
    setConfirmAction(null);
    setLoading(true);
    try {
      const res = await api.post('/cleanup/orphaned');
      setResult(res.data.message);
      setOrphaned([]);
    } finally {
      setLoading(false);
    }
  };

  const scanLarge = async () => {
    setLoading(true);
    setResult('');
    setSelectedLarge(new Set());
    try {
      const bytes = parseFloat(threshold) * 1024 * 1024;
      const res = await api.get('/cleanup/large', {
        params: { threshold: bytes },
      });
      setLargeFiles(res.data);
    } finally {
      setLoading(false);
    }
  };

  const scanOld = async () => {
    setLoading(true);
    setResult('');
    setSelectedOld(new Set());
    try {
      const res = await api.get('/cleanup/old', { params: { days } });
      setOldFiles(res.data);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (
    id: string,
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = (
    items: MediaItem[],
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const bulkDelete = async (
    ids: string[],
    setItems: React.Dispatch<React.SetStateAction<MediaItem[]>>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    setConfirmAction(null);
    setLoading(true);
    try {
      const res = await api.post('/media/bulk-delete', { ids });
      setResult(res.data.message);
      setItems((prev) => prev.filter((f) => !ids.includes(f.id)));
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  };

  const deleteSingle = async (
    id: string,
    setItems: React.Dispatch<React.SetStateAction<MediaItem[]>>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    setConfirmAction(null);
    setLoading(true);
    try {
      await api.delete(`/media/${id}`);
      setResult('Deleted 1 file');
      setItems((prev) => prev.filter((f) => f.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const renderMediaList = (
    items: MediaItem[],
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
    setItems: React.Dispatch<React.SetStateAction<MediaItem[]>>,
    showDate: boolean,
  ) => {
    if (items.length === 0) return null;

    return (
      <>
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-900 border border-gray-800 rounded-lg">
            <span className="text-sm text-gray-400">
              {selected.size} selected
            </span>
            <button
              onClick={() =>
                setConfirmAction({
                  title: 'Delete Selected',
                  message: `Delete ${selected.size} file(s)? This removes them from disk and database. This cannot be undone.`,
                  onConfirm: () =>
                    bulkDelete(Array.from(selected), setItems, setSelected),
                })
              }
              className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        )}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
            <div
              className="w-5 h-5 rounded border-2 border-gray-600 flex items-center justify-center text-xs cursor-pointer shrink-0"
              onClick={() => selectAll(items, selected, setSelected)}
            >
              {selected.size === items.length && items.length > 0 && '✓'}
            </div>
            <div className="flex-1">File</div>
            <div className="w-20 text-right">Size</div>
            <div className="w-16"></div>
          </div>
          {items.map((f) => (
            <div
              key={f.id}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                selected.has(f.id) ? 'bg-blue-900/10' : ''
              }`}
            >
              <div
                className="cursor-pointer shrink-0"
                onClick={() => toggleSelect(f.id, selected, setSelected)}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs transition-colors ${
                    selected.has(f.id)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-600'
                  }`}
                >
                  {selected.has(f.id) && '✓'}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 truncate">
                  {f.originalname}
                </p>
                <p className="text-xs text-gray-600 capitalize">
                  {f.type}
                  {showDate &&
                    ` · ${new Date(f.createdAt).toLocaleDateString()}`}
                </p>
              </div>
              <span className="text-xs text-gray-500 w-20 text-right shrink-0">
                {formatBytes(f.size)}
              </span>
              <button
                onClick={() =>
                  setConfirmAction({
                    title: 'Delete File',
                    message: `Delete "${f.originalname}"? This cannot be undone.`,
                    onConfirm: () => deleteSingle(f.id, setItems, setSelected),
                  })
                }
                className="px-2.5 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-colors shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Cleanup Tools</h2>

      <div className="flex gap-1 mb-6">
        {(['orphaned', 'large', 'old'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setResult('');
            }}
            className={`px-4 py-2 text-sm rounded-lg capitalize transition-colors ${
              tab === t
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'orphaned'
              ? 'Orphaned Files'
              : t === 'large'
                ? 'Large Files'
                : 'Old Files'}
          </button>
        ))}
      </div>

      {result && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-800 rounded-lg text-green-400 text-sm">
          {result}
        </div>
      )}

      {tab === 'orphaned' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={scanOrphaned}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {loading ? 'Scanning...' : 'Scan for Orphaned Files'}
            </button>
            {orphaned.length > 0 && (
              <button
                onClick={() =>
                  setConfirmAction({
                    title: 'Delete Orphaned Files',
                    message: `Delete ${orphaned.length} orphaned file(s) from disk? This cannot be undone.`,
                    onConfirm: deleteOrphaned,
                  })
                }
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete All ({orphaned.length})
              </button>
            )}
          </div>
          <p className="text-gray-500 text-xs mb-4">
            Files on disk that have no matching database record.
          </p>
          {orphaned.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {orphaned.map((f) => (
                <div
                  key={f.filename}
                  className="flex justify-between items-center px-4 py-3 border-b border-gray-800/50"
                >
                  <span className="text-sm text-gray-300 truncate">
                    {f.filename}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatBytes(f.size)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'large' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Threshold (MB):</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                min="1"
              />
            </div>
            <button
              onClick={scanLarge}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {loading ? 'Scanning...' : 'Scan'}
            </button>
          </div>
          <p className="text-gray-500 text-xs mb-4">
            Files larger than the specified threshold.
          </p>
          {renderMediaList(
            largeFiles,
            selectedLarge,
            setSelectedLarge,
            setLargeFiles,
            false,
          )}
        </div>
      )}

      {tab === 'old' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Older than (days):</label>
              <input
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                min="1"
              />
            </div>
            <button
              onClick={scanOld}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {loading ? 'Scanning...' : 'Scan'}
            </button>
          </div>
          <p className="text-gray-500 text-xs mb-4">
            Files older than the specified number of days.
          </p>
          {renderMediaList(
            oldFiles,
            selectedOld,
            setSelectedOld,
            setOldFiles,
            true,
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message ?? ''}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
