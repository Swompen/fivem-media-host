interface FilePreviewProps {
  type: string;
  directLink: string;
  originalname: string;
}

export default function FilePreview({
  type,
  directLink,
  originalname,
}: FilePreviewProps) {
  if (type === 'image') {
    return (
      <img
        src={directLink}
        alt={originalname}
        className="max-w-full max-h-96 rounded-lg object-contain bg-gray-800"
      />
    );
  }

  if (type === 'video') {
    return (
      <video
        src={directLink}
        controls
        className="max-w-full max-h-96 rounded-lg bg-gray-800"
      />
    );
  }

  if (type === 'audio') {
    return (
      <div className="p-8 bg-gray-800 rounded-lg">
        <p className="text-gray-400 text-sm mb-3">{originalname}</p>
        <audio src={directLink} controls className="w-full" />
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-800 rounded-lg text-center text-gray-400">
      No preview available
    </div>
  );
}
