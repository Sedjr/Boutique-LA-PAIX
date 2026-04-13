import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Trash2, Play, Pause } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onUploadComplete: (url: string) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onUploadComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Auto-upload to Firebase
        await uploadToFirebase(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error('Impossible d\'accéder au micro');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const uploadToFirebase = async (blob: Blob) => {
    setIsUploading(true);
    try {
      const fileName = `voice_notes/${Date.now()}.webm`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      onUploadComplete(downloadUrl);
      toast.success('Note vocale enregistrée');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erreur lors de l\'envoi de la note vocale');
    } finally {
      setIsUploading(false);
    }
  };

  const clearRecording = () => {
    setAudioUrl(null);
    onUploadComplete('');
  };

  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
      {!audioUrl && !isRecording && (
        <Button 
          type="button"
          onClick={startRecording} 
          variant="outline" 
          className="rounded-full w-12 h-12 p-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Mic className="h-6 w-6" />
        </Button>
      )}

      {isRecording && (
        <Button 
          type="button"
          onClick={stopRecording} 
          variant="destructive" 
          className="rounded-full w-12 h-12 p-0 animate-pulse"
        >
          <Square className="h-6 w-6" />
        </Button>
      )}

      {audioUrl && (
        <div className="flex items-center gap-2 w-full">
          <audio src={audioUrl} controls className="h-8 flex-1" />
          <Button 
            type="button"
            onClick={clearRecording} 
            variant="ghost" 
            size="icon" 
            className="text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      )}

      {isRecording && <span className="text-sm font-medium animate-pulse text-destructive">Enregistrement...</span>}
      {isUploading && <span className="text-sm text-muted-foreground italic">Envoi en cours...</span>}
    </div>
  );
};
