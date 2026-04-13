import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, ShieldCheck, Handshake } from 'lucide-react';

interface ContractViewProps {
  userName: string;
  onAccept: () => void;
  onLogout: () => void;
}

export const ContractView: React.FC<ContractViewProps> = ({ userName, onAccept, onLogout }) => {
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isBottom = Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 10;
    if (isBottom) {
      setHasReadToBottom(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-2">
        <CardHeader className="text-center space-y-2 bg-primary/5 border-b">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-2">
            <Handshake className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight uppercase">
            Contrat de Confiance - Pressing La Paix
          </CardTitle>
          <p className="text-muted-foreground">Engagement professionnel pour {userName}</p>
        </CardHeader>
        
        <CardContent className="pt-6">
          <ScrollArea className="h-[400px] pr-4 border rounded-md p-4 bg-white" onScrollCapture={handleScroll}>
            <div className="space-y-6 text-sm leading-relaxed text-slate-700">
              <section>
                <h3 className="font-bold text-lg text-primary mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5" /> 1. Objet du Contrat
                </h3>
                <p>
                  Ce contrat définit les conditions de travail et les engagements de probité attendus de la part de toute secrétaire travaillant au sein des boutiques Pressing La Paix. L'accès à l'outil de gestion est conditionné par l'acceptation pleine et entière de ce règlement.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-lg text-primary mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" /> 2. Intégrité et Transparence
                </h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Toute commande reçue doit être impérativement saisie dans le système au moment du dépôt.</li>
                  <li>Le montant encaissé doit correspondre exactement au montant saisi.</li>
                  <li>Toute remise ou geste commercial doit être validé par l'administrateur.</li>
                  <li>L'utilisation des fonds de caisse pour des besoins personnels est strictement interdite.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-lg text-primary mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5" /> 3. Horaires et Accès
                </h3>
                <p>
                  L'outil de gestion est accessible de <strong>06:00 à 22:30</strong>. En dehors de ces heures, le système est verrouillé pour garantir la sécurité des données. Toute tentative de contournement sera signalée.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-lg text-primary mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" /> 4. Confidentialité
                </h3>
                <p>
                  Les informations clients (numéros WhatsApp, factures) sont confidentielles. Elles ne doivent en aucun cas être partagées ou utilisées en dehors du cadre du service Pressing La Paix.
                </p>
              </section>

              <section className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <p className="font-bold text-orange-800">
                  En cliquant sur "J'accepte", vous confirmez avoir pris connaissance de ce règlement et vous vous engagez à le respecter scrupuleusement. Tout manquement pourra entraîner une suspension immédiate du compte.
                </p>
              </section>
              
              <div className="h-10" /> {/* Spacer to ensure scroll to bottom */}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t pt-6">
          <div className="flex items-center space-x-2 w-full">
            <Checkbox 
              id="terms" 
              checked={agreed} 
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
              disabled={!hasReadToBottom}
            />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              J'accepte les conditions de travail de La Paix
              {!hasReadToBottom && <span className="text-xs text-orange-600 ml-2">(Faites défiler jusqu'en bas pour accepter)</span>}
            </label>
          </div>
          
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={onLogout}>
              Refuser et se déconnecter
            </Button>
            <Button 
              className="flex-1 font-bold" 
              disabled={!agreed}
              onClick={onAccept}
            >
              J'accepte et je demande validation
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
