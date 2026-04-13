import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { UserProfile, Boutique, UserRole } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Users, Shield, Store, CheckCircle2, XCircle, UserCheck, UserMinus, Clock, Lock, Unlock } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLockEnabled, setTimeLockEnabled] = useState(true);

  useEffect(() => {
    // Fetch settings
    const fetchSettings = async () => {
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      if (settingsDoc.exists()) {
        setTimeLockEnabled(settingsDoc.data().timeLockEnabled);
      }
    };
    fetchSettings();

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as UserProfile[];
      setUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateUser = async (uid: string, updates: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
      toast.success('Utilisateur mis à jour');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleToggleTimeLock = async (enabled: boolean) => {
    try {
      await updateDoc(doc(db, 'settings', 'global'), { timeLockEnabled: enabled });
      setTimeLockEnabled(enabled);
      toast.success(enabled ? 'Verrouillage horaire activé' : 'Verrouillage horaire désactivé');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/global');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Gestion de l'Équipe
        </h2>
      </div>

      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Clock className="h-4 w-4" /> Paramètres Système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-base font-bold flex items-center gap-2">
                {timeLockEnabled ? <Lock className="h-4 w-4 text-orange-500" /> : <Unlock className="h-4 w-4 text-green-500" />}
                Contrôle d'Accès Temporel (06:00 - 22:30)
              </Label>
              <p className="text-sm text-muted-foreground">
                Si activé, les secrétaires ne peuvent pas accéder à l'app en dehors des heures de service.
              </p>
            </div>
            <Switch 
              checked={timeLockEnabled} 
              onCheckedChange={handleToggleTimeLock}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider">
            Liste des Utilisateurs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Boutique</TableHead>
                <TableHead>Contrat</TableHead>
                <TableHead>Approbation</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.uid}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{u.displayName || 'Sans nom'}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={u.role} 
                      onValueChange={(val: UserRole) => handleUpdateUser(u.uid, { role: val })}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="secretaire">Secrétaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={u.boutiqueAssignee} 
                      onValueChange={(val: Boutique) => handleUpdateUser(u.uid, { boutiqueAssignee: val })}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Senade">Senade</SelectItem>
                        <SelectItem value="Gankpodo">Gankpodo</SelectItem>
                        <SelectItem value="Toutes">Toutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {u.hasAcceptedContract ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Signé</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200">Non signé</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {u.isApproved ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Approuvé
                        </Badge>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs gap-1 border-orange-200 text-orange-600 hover:bg-orange-50"
                          onClick={() => handleUpdateUser(u.uid, { isApproved: true })}
                        >
                          <UserCheck className="h-3 w-3" /> Approuver
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={u.isActive} 
                        onCheckedChange={(checked) => handleUpdateUser(u.uid, { isActive: checked })}
                      />
                      <span className={`text-xs font-bold ${u.isActive ? 'text-green-600' : 'text-destructive'}`}>
                        {u.isActive ? 'Actif' : 'Suspendu'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Aucun utilisateur trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
