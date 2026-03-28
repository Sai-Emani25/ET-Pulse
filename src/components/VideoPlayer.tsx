import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, Settings, FastForward } from 'lucide-react';
import { cn } from '../lib/utils';

interface VideoPlayerProps {
  videoUrl: string;
  audioUrl?: string | null;
  className?: string;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export function VideoPlayer({ videoUrl, audioUrl, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState<{ start: number; end: number }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Thumbnail/Hover state
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  const updateBuffered = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const ranges = [];
    for (let i = 0; i < video.buffered.length; i++) {
      ranges.push({
        start: (video.buffered.start(i) / video.duration) * 100,
        end: (video.buffered.end(i) / video.duration) * 100,
      });
    }
    setBuffered(ranges);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const p = (video.currentTime / video.duration) * 100;
      setProgress(p);
      updateBuffered();
      
      if (audioRef.current && Math.abs(audioRef.current.currentTime - video.currentTime) > 0.3) {
        audioRef.current.currentTime = video.currentTime;
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      audioRef.current?.play();
    };

    const handlePause = () => {
      setIsPlaying(false);
      audioRef.current?.pause();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      audioRef.current?.pause();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', updateBuffered);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', updateBuffered);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [updateBuffered]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackSpeed;
    if (audioRef.current) audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    if (!autoPlayEnabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoRef.current?.play().catch(() => {
              // Browser might block auto-play if not muted or user hasn't interacted
              console.log("Auto-play blocked by browser");
            });
          } else {
            videoRef.current?.pause();
          }
        });
      },
      { threshold: 0.6 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [autoPlayEnabled]);

  const togglePlay = () => {
    if (videoRef.current?.paused) {
      videoRef.current.play();
    } else {
      videoRef.current?.pause();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) videoRef.current.muted = !isMuted;
    if (audioRef.current) audioRef.current.muted = !isMuted;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * duration;
    
    if (videoRef.current) videoRef.current.currentTime = time;
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * duration;
    
    setHoverTime(time);
    setHoverX(x);

    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = time;
    }
  };

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen();
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative group bg-black rounded-2xl overflow-hidden border border-line", className)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover"
        playsInline
        onClick={togglePlay}
      />
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          playsInline
        />
      )}

      {/* Hidden Preview Video for Thumbnails */}
      <video
        ref={previewVideoRef}
        src={videoUrl}
        className="hidden"
        muted
        playsInline
      />

      {/* Broadcast Overlay */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 pointer-events-none z-10">
        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-white">ET Pulse Live</span>
      </div>

      {/* Controls Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-20">
        <div className="space-y-4">
          
          {/* Custom Progress Bar */}
          <div className="relative h-6 flex items-center group/progress cursor-pointer"
               ref={progressBarRef}
               onMouseMove={handleMouseMove}
               onMouseLeave={() => setHoverTime(null)}
               onClick={handleSeek}>
            
            {/* Thumbnail Preview */}
            {hoverTime !== null && (
              <div 
                className="absolute bottom-full mb-4 -translate-x-1/2 pointer-events-none transition-all"
                style={{ left: hoverX }}
              >
                <div className="bg-[#111] border border-line rounded-lg overflow-hidden shadow-2xl w-32 aspect-video relative">
                  <video
                    src={videoUrl}
                    className="w-full h-full object-cover"
                    ref={(el) => {
                      if (el) el.currentTime = hoverTime;
                    }}
                  />
                  <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-white">
                    {formatTime(hoverTime)}
                  </div>
                </div>
                <div className="w-px h-4 bg-accent mx-auto mt-1" />
              </div>
            )}

            <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden group-hover/progress:h-2 transition-all">
              {/* Buffered Bar */}
              {buffered.map((range, i) => (
                <div 
                  key={i}
                  className="absolute h-full bg-white/20"
                  style={{ left: `${range.start}%`, width: `${range.end - range.start}%` }}
                />
              ))}
              {/* Progress Bar */}
              <div 
                className="absolute h-full bg-accent"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Handle */}
            <div 
              className="absolute w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="text-white hover:text-accent transition-colors">
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              <button onClick={() => { if(videoRef.current) videoRef.current.currentTime = 0; }} className="text-white hover:text-accent transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="text-white hover:text-accent transition-colors">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <span className="text-[10px] font-mono text-white/60">
                  {formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Auto Play Toggle */}
              <button 
                onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
                className={cn(
                  "text-[10px] font-mono uppercase tracking-widest transition-colors px-2 py-1 rounded border border-white/10",
                  autoPlayEnabled ? "text-accent border-accent/30 bg-accent/5" : "text-white/60 hover:text-white"
                )}
                title="Auto-play when visible"
              >
                Auto: {autoPlayEnabled ? 'ON' : 'OFF'}
              </button>

              {/* Playback Speed */}
              <div className="relative">
                <button 
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="flex items-center gap-1 text-[10px] font-mono text-white/60 hover:text-white transition-colors uppercase tracking-widest"
                >
                  <FastForward className="w-3 h-3" />
                  {playbackSpeed}x
                </button>
                
                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-[#111] border border-line rounded-lg overflow-hidden py-1 min-w-[60px] shadow-xl">
                    {PLAYBACK_SPEEDS.map(speed => (
                      <button
                        key={speed}
                        onClick={() => {
                          setPlaybackSpeed(speed);
                          setShowSpeedMenu(false);
                        }}
                        className={cn(
                          "w-full px-3 py-1.5 text-[10px] font-mono text-left hover:bg-white/10 transition-colors",
                          playbackSpeed === speed ? "text-accent" : "text-white/60"
                        )}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={handleFullscreen} className="text-white hover:text-accent transition-colors">
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Center Play Button (Visible when paused) */}
      {!isPlaying && !videoRef.current?.ended && (
        <button 
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors z-30"
        >
          <div className="w-16 h-16 rounded-full bg-accent/90 flex items-center justify-center text-black scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-8 h-8 fill-current ml-1" />
          </div>
        </button>
      )}
    </div>
  );
}
