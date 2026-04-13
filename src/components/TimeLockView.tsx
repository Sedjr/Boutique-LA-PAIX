import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Lock, LogOut } from 'lucide-react';

interface TimeLockViewProps {
  onLogout: () => void;
}

export const TimeLockView: React.FC<TimeLockViewProps> = ({ onLogout }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-none bg-slate-800 text-white">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-orange-500/20 w-24 h-24 rounded-full flex items-center justify-center mb-2 animate-pulse">
            <Lock className="h-12 w-12 text-orange-500" />
          </div>
          <CardTitle className="text-3xl font-black tracking-tighter uppercase text-orange-500">
            SYSTÈME VERROUILLÉ
          </CardTitle>
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Clock className="h-5 w-5" />
            <span className="font-mono text-lg">Hors Heures de Service</span>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6 text-center">
          <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600">
            <p className="text-slate-300 mb-4">
              Le Pressing La Paix est actuellement fermé. L'accès à la base de données est suspendu pour des raisons de sécurité.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Horaires d'ouverture</p>
              <p className="text-2xl font-black text-white">06:00 — 22:30</p>
            </div>
          </div>

          <Button 
            onClick={onLogout} 
            variant="ghost" 
            className="w-full text-slate-400 hover:text-white hover:bg-slate-700 gap-2"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
