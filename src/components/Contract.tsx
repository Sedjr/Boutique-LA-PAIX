import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { CheckCircle2, ShieldCheck, FileText, LogOut, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface ContractProps {
  userUid: string;
  onAccept: () => void;
  onLogout: () => void;
}

export const Contract: React.FC<ContractProps> = ({ userUid, onAccept, onLogout }) => {
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await updateDoc(doc(db, 'users', userUid), {
        hasAcceptedContract: true
      });
      toast.success('Contrat signé avec succès');
      onAccept();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userUid}`);
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-2">
        <CardHeader className="bg-primary/5 border-b pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary p-2 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-black">CONTRAT D'UTILISATION</CardTitle>
          </div>
          <p className="text-muted-foreground font-medium">
            Veuillez lire et accepter les conditions d'utilisation du système Pressing La Paix.
          </p>
        </CardHeader>
        <CardContent className="py-8 space-y-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4 text-sm leading-relaxed">
            <section className="space-y-2">
              <h3 className="font-black text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> 1. Engagement de Confidentialité
              </h3>
              <p>
                En tant qu'utilisateur du système, vous vous engagez à maintenir la confidentialité absolue des données clients (noms, numéros de téléphone) et des chiffres d'affaires de la boutique. Toute fuite de données pourra entraîner des poursuites.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-black text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> 2. Responsabilité de Caisse
              </h3>
              <p>
                Chaque secrétaire est responsable de l'exactitude des montants enregistrés dans sa caisse. Les prélèvements et dépenses doivent être justifiés en temps réel. Tout écart non justifié sera à la charge de l'agent.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-black text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> 3. Utilisation du Système
              </h3>
              <p>
                L'utilisation du système est strictement réservée au cadre professionnel. L'accès est personnel et ne doit pas être partagé. Le système enregistre automatiquement l'appareil et l'heure de chaque connexion pour des raisons de sécurité.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-black text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> 4. Communication Client
              </h3>
              <p>
                Les reçus WhatsApp doivent être envoyés systématiquement après chaque commande. Le ton utilisé avec les clients doit rester professionnel et courtois en toutes circonstances.
              </p>
            </section>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 border-t p-6 flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={handleAccept} 
            disabled={isAccepting}
            className="flex-1 h-14 text-lg font-black gap-2 shadow-lg shadow-primary/20"
          >
            {isAccepting ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <CheckCircle2 className="h-6 w-6" />
            )}
            SIGNER ET ACCEPTER
          </Button>
          <Button 
            variant="outline" 
            onClick={onLogout}
            className="h-14 px-8 font-bold gap-2"
          >
            <LogOut className="h-5 w-5" />
            DÉCONNEXION
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
