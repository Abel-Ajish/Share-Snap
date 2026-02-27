import { useState, useRef, useEffect } from "react";
import { 
  UploadCloud, 
  QrCode, 
  Wifi, 
  X, 
  FileText, 
  Image as ImageIcon, 
  Music, 
  Video, 
  Clock, 
  Send,
  CheckCircle2,
  Smartphone,
  Laptop
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";

// Types
type FileItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  expiresAt: number; // timestamp
  status: 'uploading' | 'ready' | 'sending' | 'sent';
};

type Peer = {
  id: string;
  name: string;
  deviceType: 'phone' | 'laptop';
  distance: string;
  color: string;
};

// Mock Data
const MOCK_PEERS: Peer[] = [
  { id: '1', name: "Alex's iPhone", deviceType: 'phone', distance: "Near", color: "bg-primary-container text-on-primary-container" },
  { id: '2', name: "MacBook Pro", deviceType: 'laptop', distance: "Far", color: "bg-secondary-container text-on-secondary-container" },
  { id: '3', name: "Studio Mac", deviceType: 'laptop', distance: "Near", color: "bg-tertiary-container text-on-tertiary-container" },
];

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Timer to update countdowns and remove expired files
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      setFiles(prev => prev.filter(f => f.expiresAt > now));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-6 h-6" />;
    if (type.startsWith('audio/')) return <Music className="w-6 h-6" />;
    if (type.startsWith('video/')) return <Video className="w-6 h-6" />;
    return <FileText className="w-6 h-6" />;
  };

  const handleFilesAdded = (newFiles: FileList | File[]) => {
    const items: FileItem[] = Array.from(newFiles).map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      expiresAt: Date.now() + 60000, // 1 minute from now
      status: 'uploading'
    }));

    setFiles(prev => [...prev, ...items]);

    // Simulate upload progress
    items.forEach(item => {
      let prog = 0;
      const interval = setInterval(() => {
        prog += Math.random() * 20;
        if (prog >= 100) {
          prog = 100;
          clearInterval(interval);
          setFiles(prev => prev.map(f => 
            f.id === item.id ? { ...f, progress: 100, status: 'ready' } : f
          ));
        } else {
          setFiles(prev => prev.map(f => 
            f.id === item.id ? { ...f, progress: prog } : f
          ));
        }
      }, 200);
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const sendFile = (fileId: string, peerId: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'sending' } : f
    ));
    
    // Simulate send complete
    setTimeout(() => {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'sent' } : f
      ));
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Sidebar / Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto no-scrollbar p-4 md:p-8">
        
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <Wifi className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Drop</h1>
          </div>
          <button 
            onClick={() => setShowQR(true)}
            className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-2 rounded-full font-medium text-sm transition-transform active:scale-95 hover:bg-secondary-container/80"
          >
            <QrCode className="w-4 h-4" />
            Receive
          </button>
        </header>

        {/* Upload Area */}
        <motion.div 
          className={`relative border-2 border-dashed rounded-[32px] p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300 ease-out mb-8 ${
            isDragging 
              ? 'border-primary bg-primary-container/30' 
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
        >
          <input 
            type="file" 
            multiple 
            className="hidden" 
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
          />
          <div className="w-20 h-20 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center mb-6 shadow-sm">
            <UploadCloud className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold font-display mb-2">Tap or drag files here</h2>
          <p className="text-muted-foreground max-w-sm mb-4">
            Files are shared instantly and securely. They will self-destruct in exactly 1 minute.
          </p>
          <div className="bg-background px-4 py-2 rounded-full shadow-sm text-sm font-medium border border-border inline-flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            1-minute auto-deletion active
          </div>
        </motion.div>

        {/* Active Transfers */}
        <div className="flex-1">
          <h3 className="text-lg font-bold font-display mb-4 px-2">Active Files</h3>
          <AnimatePresence>
            {files.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center p-8 text-muted-foreground flex flex-col items-center"
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 opacity-20" />
                </div>
                <p>No active transfers.</p>
              </motion.div>
            ) : (
              <div className="grid gap-4">
                {files.map(file => {
                  const secondsLeft = Math.max(0, Math.ceil((file.expiresAt - currentTime) / 1000));
                  
                  return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                      layout
                      className="bg-card rounded-[24px] p-4 flex flex-col gap-4 shadow-sm border border-border/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-2xl flex items-center justify-center shrink-0">
                          {getFileIcon(file.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate">{file.name}</h4>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{formatSize(file.size)}</span>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                            <span className={`font-mono font-medium ${secondsLeft < 10 ? 'text-destructive' : 'text-primary'}`}>
                              00:{secondsLeft.toString().padStart(2, '0')}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Progress Bar or Action */}
                      <div className="px-1">
                        {file.status === 'uploading' && (
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-primary"
                              initial={{ width: 0 }}
                              animate={{ width: `${file.progress}%` }}
                            />
                          </div>
                        )}
                        
                        {file.status === 'ready' && (
                          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground self-center mr-2">Send to:</div>
                            {MOCK_PEERS.map(peer => (
                              <button
                                key={peer.id}
                                onClick={() => sendFile(file.id, peer.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${peer.color} hover:opacity-90 transition-opacity active:scale-95`}
                              >
                                {peer.deviceType === 'phone' ? <Smartphone className="w-3.5 h-3.5" /> : <Laptop className="w-3.5 h-3.5" />}
                                {peer.name}
                              </button>
                            ))}
                          </div>
                        )}

                        {file.status === 'sending' && (
                          <div className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full w-fit">
                            <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            Sending...
                          </div>
                        )}

                        {file.status === 'sent' && (
                          <div className="flex items-center gap-2 text-sm font-medium text-green-600 bg-green-500/10 px-3 py-1.5 rounded-full w-fit">
                            <CheckCircle2 className="w-4 h-4" />
                            Sent successfully
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Right Sidebar - Peers (Visible on large screens, or drawer on mobile) */}
      <aside className="w-full md:w-80 bg-surface border-l border-border p-6 flex flex-col gap-6 rounded-t-[32px] md:rounded-none md:rounded-l-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.05)] md:shadow-none z-10">
        <div>
          <h2 className="text-xl font-bold font-display mb-1 text-foreground">Nearby Devices</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Looking for peers...
          </p>
        </div>

        <div className="flex flex-col gap-3 flex-1 overflow-y-auto no-scrollbar">
          {MOCK_PEERS.map(peer => (
            <div 
              key={peer.id}
              className="bg-card p-4 rounded-[20px] flex items-center gap-4 cursor-pointer hover:bg-card/80 transition-colors border border-border/50"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${peer.color}`}>
                {peer.deviceType === 'phone' ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">{peer.name}</div>
                <div className="text-xs text-muted-foreground">{peer.distance}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-primary-container p-5 rounded-[24px] mt-auto">
          <h3 className="font-bold text-on-primary-container mb-2 font-display">Not finding someone?</h3>
          <p className="text-sm text-on-primary-container/80 mb-4">Ensure both devices are on the same network or scan a QR code.</p>
          <button 
            onClick={() => setShowQR(true)}
            className="w-full bg-primary text-primary-foreground py-3 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-95"
          >
            <QrCode className="w-4 h-4" />
            Show QR Code
          </button>
        </div>
      </aside>

      {/* QR Code Dialog Overlay */}
      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowQR(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-card relative z-10 max-w-sm w-full p-8 rounded-[32px] shadow-2xl flex flex-col items-center border border-border"
            >
              <button 
                onClick={() => setShowQR(false)}
                className="absolute top-4 right-4 w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                <QrCode className="w-8 h-8" />
              </div>
              
              <h2 className="text-2xl font-bold font-display text-center mb-2">Scan to connect</h2>
              <p className="text-center text-muted-foreground text-sm mb-8">
                Point your camera at this code to quickly join this local sharing session.
              </p>
              
              <div className="bg-white p-4 rounded-3xl shadow-sm">
                <QRCodeSVG 
                  value="https://replit.com/@replit/drop" 
                  size={200}
                  level="H"
                  fgColor="#000000"
                  bgColor="#ffffff"
                  imageSettings={{
                    src: "/favicon.png",
                    x: undefined,
                    y: undefined,
                    height: 24,
                    width: 24,
                    excavate: true,
                  }}
                />
              </div>
              
              <p className="mt-8 text-xs font-mono bg-muted px-4 py-2 rounded-full text-muted-foreground">
                ID: drop-session-a8f9
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}