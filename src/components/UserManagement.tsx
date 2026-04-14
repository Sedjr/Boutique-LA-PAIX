import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDoc, writeBatch, where, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import { UserProfile, Boutique, UserRole, AdminAlert } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Users, Shield, Store, CheckCircle2, XCircle, UserCheck, UserMinus, Clock, Lock, Unlock, AlertCircle, Trash2 } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
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
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as UserProfile[];
      setUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const alertsQuery = query(
      collection(db, 'alertes_admin'),
      where('lu', '==', false),
      orderBy('heure', 'desc')
    );
    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminAlert[];
      setAlerts(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'alertes_admin');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeAlerts();
    };
  }, []);

  const handleApproveUser = async (uid: string, email: string) => {
    try {
      const batch = writeBatch(db);
      
      // Approve user
      batch.update(doc(db, 'users', uid), { 
        isApproved: true,
        isActive: true,
        role: 'secretaire',
        boutiqueAssignee: 'Senade'
      });
      
      // Mark alerts for this email as read
      const alertsRef = collection(db, 'alertes_admin');
      const q = query(alertsRef, where('email', '==', email), where('lu', '==', false));
      const alertDocs = await getDocs(q);
      alertDocs.forEach(alertDoc => {
        batch.update(doc(db, 'alertes_admin', alertDoc.id), { lu: true });
      });
      
      await batch.commit();
      toast.success('Utilisateur approuvé et alertes traitées');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleUpdateUser = async (uid: string, updates: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
      toast.success('Utilisateur mis à jour');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDeleteUser = async (uid: string, email: string) => {
    if (!window.confirm(`Voulez-vous supprimer définitivement le compte de ${email} ?`)) return;
    
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('Utilisateur supprimé définitivement');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
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

  const isDuplicateEmail = (email: string) => {
    return users.filter(u => u.email === email).length > 1;
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

      {alerts.length > 0 && (
        <Card className="border-2 border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Nouvelles Tentatives de Connexion ({alerts.length})
            </CardTitle>
            <CardDescription>
              Ces utilisateurs attendent votre approbation pour accéder au système.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Heure</TableHead>
                  <TableHead>Appareil</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-bold">{alert.email}</TableCell>
                    <TableCell className="text-xs">{alert.heure?.toDate().toLocaleString()}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground truncate max-w-[200px]">{alert.appareil}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700 font-bold"
                        onClick={() => {
                          const user = users.find(u => u.email === alert.email);
                          if (user) handleApproveUser(user.uid, user.email);
                        }}
                      >
                        Approuver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.uid}>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{u.displayName || 'Sans nom'}</span>
                        {isDuplicateEmail(u.email) && (
                          <Badge variant="destructive" className="h-5 text-[10px] px-1.5 font-black animate-pulse">
                            ⚠️ DOUBLON
                          </Badge>
                        )}
                      </div>
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
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Signé
                      </Badge>
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
                          onClick={() => handleApproveUser(u.uid, u.email)}
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
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 h-8 w-8"
                      onClick={() => handleDeleteUser(u.uid, u.email)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
