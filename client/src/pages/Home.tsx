import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
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
  Laptop,
  Moon,
  Sun
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { useShareSnap } from "@/hooks/use-share-snap";

// Types from hook
type FileItem = {
  id: string;
  name: string;
  size: bigint;
  mimeType: string;
  expiresAt: Date;
  status: 'uploading' | 'ready' | 'sending' | 'sent';
  progress: number;
};

type Peer = {
  id: string;
  name: string;
  deviceType: 'phone' | 'laptop' | 'tablet' | 'desktop';
  isOnline: boolean;
};

export default function Home() {
  const [match, params] = useRoute("/:sessionToken?");
  const [isDragging, setIsDragging] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [editedName, setEditedName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const { 
    sessionToken, 
    peers, 
    files, 
    uploadFile, 
    deleteFile, 
    sendFileToPeer,
    changePeerName,
    currentPeerName,
    currentPeerId,
    isLoading,
    error
  } = useShareSnap({
    peerName: "My Device",
    deviceType: "laptop",
    sessionToken: params?.sessionToken,
  });

  // Initialize edited name when component mounts or currentPeerName changes
  useEffect(() => {
    setEditedName(currentPeerName);
  }, [currentPeerName]);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Timer to update countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatSize = (bytes: number | bigint) => {
    const num = typeof bytes === 'bigint' ? Number(bytes) : bytes;
    if (num < 1024) return num + " B";
    if (num < 1024 * 1024) return (num / 1024).toFixed(1) + " KB";
    return (num / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-6 h-6" />;
    if (type.startsWith('audio/')) return <Music className="w-6 h-6" />;
    if (type.startsWith('video/')) return <Video className="w-6 h-6" />;
    return <FileText className="w-6 h-6" />;
  };

  const handleFilesAdded = (newFiles: FileList | File[]) => {
    Array.from(newFiles).forEach(file => {
      uploadFile(file);
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
    deleteFile(id);
  };

  const sendFile = (fileId: string, peerId: string) => {
    sendFileToPeer(fileId, peerId);
  };

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType === 'phone') return <Smartphone className="w-6 h-6" />;
    return <Laptop className="w-6 h-6" />;
  };

  const getPeerColor = (index: number) => {
    const colors = [
      "bg-primary-container text-on-primary-container",
      "bg-secondary-container text-on-secondary-container",
      "bg-tertiary-container text-on-tertiary-container",
    ];
    return colors[index % colors.length];
  };

  const handleSaveName = async () => {
    if (editedName.trim()) {
      await changePeerName(editedName.trim());
      setShowNameEdit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row overflow-hidden font-sans transition-colors duration-500">
      
      {/* Sidebar / Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto no-scrollbar p-4 md:p-8">
        
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <motion.div 
              initial={{ rotate: -10, scale: 0.9 }}
              animate={{ rotate: 0, scale: 1 }}
              className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20"
            >
              <Wifi className="w-5 h-5" />
            </motion.div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Drop</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-full">
                {error}
              </div>
            )}
            <button
              onClick={() => setShowNameEdit(true)}
              className="text-sm bg-muted hover:bg-muted/80 px-3 py-2 rounded-full transition-colors"
              title={`Current device: ${currentPeerName}`}
            >
              {currentPeerName}
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setShowQR(true)}
              className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-2 rounded-full font-medium text-sm transition-transform active:scale-95 hover:bg-secondary-container/80"
            >
              <QrCode className="w-4 h-4" />
              Receive
            </button>
          </div>
        </header>

        {/* Upload Area */}
        <motion.div 
          className={`relative border-2 border-dashed rounded-[40px] p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-500 ease-out mb-8 group ${
            isDragging 
              ? 'border-primary bg-primary-container/30 scale-[0.99] shadow-inner' 
              : 'border-border hover:border-primary/50 hover:bg-muted/30 hover:shadow-xl hover:shadow-primary/5'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          whileTap={{ scale: 0.98 }}
        >
          <input 
            type="file" 
            multiple 
            className="hidden" 
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
          />
          <motion.div 
            animate={isDragging ? { y: [0, -10, 0] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-24 h-24 bg-primary-container text-on-primary-container rounded-3xl flex items-center justify-center mb-6 shadow-md group-hover:scale-110 transition-transform duration-300"
          >
            <UploadCloud className="w-12 h-12" />
          </motion.div>
          <h2 className="text-3xl font-bold font-display mb-2">Drop your files here</h2>
          <p className="text-muted-foreground max-w-sm mb-6 text-lg">
            Encrypted P2P transfers. No storage. No traces.
          </p>
          <div className="bg-background/80 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg text-sm font-semibold border border-border inline-flex items-center gap-2 group-hover:border-primary/30 transition-colors">
            <Clock className="w-4 h-4 text-primary animate-pulse" />
            <span>1 minute till auto-deletion</span>
          </div>
        </motion.div>

        {/* Active Transfers */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6 px-2">
            <h3 className="text-xl font-bold font-display">Active Files</h3>
            {files.length > 0 && (
              <span className="text-xs font-bold px-2 py-1 bg-primary/10 text-primary rounded-md uppercase tracking-widest">
                {files.length} {files.length === 1 ? 'File' : 'Files'}
              </span>
            )}
          </div>
          
          <AnimatePresence mode="popLayout">
            {files.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center p-12 text-muted-foreground flex flex-col items-center border border-dashed border-border rounded-[32px] bg-muted/10"
              >
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                  <FileText className="w-10 h-10 opacity-30" />
                </div>
                <p className="text-lg font-medium opacity-60">Ready for drop-off</p>
                <p className="text-sm opacity-40">Your files will appear here while they're active.</p>
              </motion.div>
            ) : (
              <div className="grid gap-4">
                {files.map(file => {
                  const secondsLeft = Math.max(0, Math.ceil((file.expiresAt.getTime() - currentTime) / 1000));
                  
                  return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, x: -20, transition: { duration: 0.2 } }}
                      layout
                      className="bg-card rounded-[32px] p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow border border-border/50 relative overflow-hidden group"
                    >
                      {/* Expiration Progress Overlay */}
                      <motion.div 
                        className="absolute bottom-0 left-0 h-1 bg-destructive/20"
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: 60, ease: "linear" }}
                      />

                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-primary-container text-on-primary-container rounded-[20px] flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                          {getFileIcon(file.mimeType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-foreground truncate text-lg tracking-tight">{file.name}</h4>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
                            <span>{formatSize(file.size)}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-border"></span>
                            <div className="flex items-center gap-1.5">
                              <Clock className={`w-3.5 h-3.5 ${secondsLeft < 10 ? 'text-destructive animate-pulse' : 'text-primary'}`} />
                              <span className={`font-mono ${secondsLeft < 10 ? 'text-destructive font-bold' : 'text-primary'}`}>
                                {secondsLeft}s
                              </span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                          className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all active:scale-90"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Progress Bar or Action */}
                      <div className="px-1">
                        {file.status === 'uploading' && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-primary uppercase tracking-tighter">
                              <span>Encrypting</span>
                              <span>{Math.round(file.progress)}%</span>
                            </div>
                            <div className="w-full h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                              <motion.div 
                                className="h-full bg-gradient-to-r from-primary/80 to-primary"
                                initial={{ width: 0 }}
                                animate={{ width: `${file.progress}%` }}
                                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {file.status === 'ready' && (
                          <div className="flex flex-col gap-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">Send to target</div>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                              {peers.filter(p => p.id !== currentPeerId).length > 0 ? peers.filter(p => p.id !== currentPeerId).map((peer, index) => (
                                <button
                                  key={peer.id}
                                  onClick={() => sendFile(file.id, peer.id)}
                                  className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap ${getPeerColor(index)} hover:shadow-lg transition-all active:scale-95 group/peer`}
                                >
                                  {peer.deviceType === 'phone' ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                                  {peer.name}
                                  <Send className="w-3.5 h-3.5 opacity-0 group-hover/peer:opacity-100 -translate-x-2 group-hover/peer:translate-x-0 transition-all" />
                                </button>
                              )) : (
                                <div className="text-xs text-muted-foreground px-4 py-2">No peers available</div>
                              )}
                            </div>
                          </div>
                        )}

                        {file.status === 'sending' && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3 text-sm font-bold text-primary bg-primary/10 px-5 py-2.5 rounded-2xl w-full justify-center"
                          >
                            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            Establishing P2P link...
                          </motion.div>
                        )}

                        {file.status === 'sent' && (
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex items-center gap-3 text-sm font-bold text-green-600 bg-green-500/10 px-5 py-2.5 rounded-2xl w-full justify-center border border-green-500/20"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            Transfer Complete
                          </motion.div>
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

      {/* Right Sidebar - Peers */}
      <aside className="w-full md:w-96 bg-surface border-l border-border p-8 flex flex-col gap-8 rounded-t-[48px] md:rounded-none md:rounded-l-[48px] shadow-2xl z-10">
        <div>
          <h2 className="text-2xl font-bold font-display mb-2 text-foreground">Discovery</h2>
          <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-full w-fit pr-4 border border-border/50">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              {peers.length > 0 ? `${peers.length} Online` : 'Scanning local network'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 flex-1 overflow-y-auto no-scrollbar">
          {peers.length > 0 ? peers.map((peer, index) => (
            <motion.div 
              key={peer.id}
              whileHover={{ x: 5, scale: 1.02 }}
              className="bg-card p-5 rounded-[28px] flex items-center gap-5 cursor-pointer hover:bg-card/80 transition-all border border-border/50 shadow-sm"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${getPeerColor(index)}`}>
                {getDeviceIcon(peer.deviceType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground truncate text-lg">{peer.name}</div>
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-tighter">
                  <Wifi className="w-3 h-3" />
                  {peer.isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
            </motion.div>
          )) : (
            <div className="text-center text-muted-foreground p-8">
              <p className="text-sm">No other devices detected</p>
              <p className="text-xs opacity-60 mt-2">Make sure they're on the same network</p>
            </div>
          )}
        </div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-gradient-to-br from-primary-container to-secondary-container p-6 rounded-[36px] mt-auto shadow-xl shadow-primary/5 border border-white/10"
        >
          <h3 className="font-black text-on-primary-container mb-2 font-display text-lg uppercase tracking-tight">Visibility Hidden?</h3>
          <p className="text-sm text-on-primary-container/70 mb-6 font-medium leading-relaxed">Ensure you're on the same Wi-Fi or use a secure link.</p>
          <button 
            onClick={() => setShowQR(true)}
            className="w-full bg-foreground text-background py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-95 shadow-lg"
          >
            <QrCode className="w-5 h-5" />
            Join Discovery
          </button>
        </motion.div>
      </aside>

      {/* QR Code Dialog Overlay */}
      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/90 backdrop-blur-xl"
              onClick={() => setShowQR(false)}
            />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              className="bg-card relative z-10 max-w-sm w-full p-10 rounded-[48px] shadow-2xl flex flex-col items-center border border-border overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-secondary to-tertiary"></div>
              
              <button 
                onClick={() => setShowQR(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-muted text-muted-foreground rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                <QrCode className="w-10 h-10" />
              </div>
              
              <h2 className="text-3xl font-bold font-display text-center mb-3">Sync Devices</h2>
              <p className="text-center text-muted-foreground font-medium text-sm mb-10 px-4 leading-relaxed">
                Scan this code to establish a secure, ephemeral tunnel between devices.
              </p>
              
              <div className="bg-white p-6 rounded-[40px] shadow-2xl border-4 border-muted">
                <QRCodeSVG 
                  value={sessionToken ? `https://drop.local/${sessionToken}` : "https://drop.local"} 
                  size={200}
                  level="H"
                  fgColor="#000000"
                  bgColor="#ffffff"
                  imageSettings={{
                    src: "/favicon.png",
                    x: undefined,
                    y: undefined,
                    height: 32,
                    width: 32,
                    excavate: true,
                  }}
                />
              </div>
              
              <div className="mt-10 flex flex-col items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Session Token</span>
                <p className="text-sm font-black bg-muted px-6 py-3 rounded-2xl text-foreground font-mono shadow-inner border border-border/50 tracking-widest">
                  {sessionToken || "LOADING..."}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Name Edit Dialog */}
      <AnimatePresence>
        {showNameEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/90 backdrop-blur-xl"
              onClick={() => setShowNameEdit(false)}
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              className="bg-card relative z-10 max-w-sm w-full p-8 rounded-[48px] shadow-2xl flex flex-col items-center border border-border overflow-hidden"
            >
              <h2 className="text-2xl font-bold mb-4">Rename Device</h2>
              <input
                type="text"
                className="w-full px-4 py-3 border border-border rounded-lg mb-4"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNameEdit(false)}
                  className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveName}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
