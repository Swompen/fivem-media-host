import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import FilePreview from '../components/FilePreview';
import ConfirmDialog from '../components/ConfirmDialog';
import CopyButton from '../components/CopyButton';

interface MediaDetail {
  id: string;
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
  type: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  url: string;
  directLink: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [media, setMedia] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    api
      .get(`/media/${id}`)
      .then((res) => setMedia(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    await api.delete(`/media/${id}`);
    navigate('/media', { replace: true });
  };

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading...</div>;
  }

  if (!media) {
    return <div className="text-red-400 text-sm">Media not found</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/media"
          className="text-gray-500 hover:text-white text-sm transition-colors"
        >
          &larr; Back
        </Link>
        <h2 className="text-xl font-semibold text-white truncate flex-1">
          {media.originalname}
        </h2>
        <button
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Delete
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <FilePreview
            type={media.type}
            directLink={media.directLink}
            originalname={media.originalname}
          />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            Details
          </h3>
          {[
            ['ID', media.id],
            ['Original Name', media.originalname],
            ['Filename', media.filename],
            ['MIME Type', media.mimetype],
            ['Type', media.type],
            ['Size', formatBytes(media.size)],
            ['Views', String(media.views)],
            ['Created', new Date(media.createdAt).toLocaleString()],
            ['Updated', new Date(media.updatedAt).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500">{label}</span>
              <span className="text-sm text-gray-300 text-right truncate ml-4 max-w-[60%]">
                {value}
              </span>
            </div>
          ))}
          <div className="pt-3 border-t border-gray-800 space-y-2">
            <div className="flex gap-2">
              <CopyButton
                text={media.directLink}
                label="Direct Link"
                className="flex-1 justify-center px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
              />
              <CopyButton
                text={media.url}
                label="API Link"
                className="flex-1 justify-center px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
              />
            </div>
            <a
              href={media.directLink}
              target="_blank"
              rel="noreferrer"
              className="block text-center px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              Open Direct Link
            </a>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Delete Media"
        message={`Are you sure you want to delete "${media.originalname}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
