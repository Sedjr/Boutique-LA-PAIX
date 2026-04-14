import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Order, TypeService, Boutique } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WashingMachine, Shirt, CheckCircle2, MessageSquare, Trash2, Edit, Play, Store, Zap, Droplets, ChevronRight, Phone, Calendar, CreditCard, Info, Mail } from 'lucide-react';
import { sendWhatsAppReceipt, sendArrivalNotification } from '../lib/whatsapp';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface OrderListProps {
  onEdit: (order: Order) => void;
  isAdmin: boolean;
  userBoutique: Boutique;
  agentName: string;
}

export const OrderList: React.FC<OrderListProps> = ({ onEdit, isAdmin, userBoutique, agentName }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!userBoutique) return;

    let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    
    if (userBoutique !== 'Toutes') {
      q = query(collection(db, 'orders'), 
        where('boutiqueSource', '==', userBoutique),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, [userBoutique]);

  const handleSendReceipt = async (order: Order) => {
    sendWhatsAppReceipt(order);
    try {
      await updateDoc(doc(db, 'orders', order.id!), {
        recuEnvoye: true,
        envoyePar: agentName,
        dateEnvoiRecu: serverTimestamp()
      });
    } catch (err) {
      console.error("Error updating receipt status:", err);
    }
  };

  const handleSendArrival = async (order: Order) => {
    sendArrivalNotification(order);
    try {
      await updateDoc(doc(db, 'orders', order.id!), {
        notifArriveeEnvoyee: true, // Optional field for tracking
        notifPar: agentName,
        dateNotifArrivee: serverTimestamp()
      });
    } catch (err) {
      console.error("Error updating arrival status:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette commande ?')) return;
    try {
      await deleteDoc(doc(db, 'orders', id));
      toast.success('Commande supprimée');
      if (selectedOrder?.id === id) setSelectedOrder(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${id}`);
    }
  };

  const getServiceIcon = (service: TypeService) => {
    switch (service) {
      case 'Lavage': return <WashingMachine className="h-8 w-8 text-blue-500" />;
      case 'Repassage': return <Shirt className="h-8 w-8 text-orange-500" />;
      case 'Teinture': return <Droplets className="h-8 w-8 text-purple-500" />;
    }
  };

  const getServiceBadge = (service: TypeService) => {
    switch (service) {
      case 'Lavage': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Lavage</Badge>;
      case 'Repassage': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Repassage</Badge>;
      case 'Teinture': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Teinture</Badge>;
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement des commandes...</div>;

  return (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[100px]">Facture</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Dates</TableHead>
              {isAdmin && <TableHead>Agent</TableHead>}
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Reste</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {orders.map((order) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="group hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <TableCell className="font-mono font-bold text-lg">
                    <div className="flex flex-col">
                      <span>#{order.numeroFacture}</span>
                      {order.isExpress && (
                        <Badge className="bg-orange-500 text-[10px] h-4 px-1 w-fit">EXPRESS</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-primary">{order.civilite} {order.nomClient}</div>
                    <div className="font-medium text-xs">{order.telephone}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">{order.modePaiement}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {getServiceIcon(order.typeService)}
                      {getServiceBadge(order.typeService)}
                      {order.recuEnvoye && (
                        <Mail className="h-4 w-4 text-green-500" title={`Reçu envoyé par ${order.envoyePar}`} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div className="text-muted-foreground">Dépôt: {order.dateDepot}</div>
                      <div className="font-bold text-primary">Retrait: {order.dateRetraitPrevue}</div>
                    </div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                      {order.agent_saisie || 'Inconnu'}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-semibold">{order.montantTotal} F</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold ${order.resteAPayer > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {order.resteAPayer} F
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        title="Modifier"
                        className="rounded-full hover:bg-primary hover:text-primary-foreground"
                        onClick={() => onEdit(order)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                        <Button 
                          variant="outline" 
                          size="icon" 
                          title="Envoyer Reçu"
                          className="rounded-full bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border-green-200"
                          onClick={() => handleSendReceipt(order)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          size="icon" 
                          title="Confirmer Arrivée"
                          className="rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border-blue-200"
                          onClick={() => handleSendArrival(order)}
                        >
                          <Store className="h-4 w-4" />
                        </Button>

                      {isAdmin && (
                        <Button 
                          variant="outline" 
                          size="icon" 
                          title="Supprimer"
                          className="rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/20"
                          onClick={() => handleDelete(order.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Mobile List View */}
      <div className="md:hidden space-y-3">
        <AnimatePresence mode="popLayout">
          {orders.map((order) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-card border-2 rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg">#{order.numeroFacture}</span>
                    {order.isExpress && (
                      <Badge className="bg-orange-500 text-[10px] h-4 px-1">EXPRESS</Badge>
                    )}
                  </div>
                  <div className="font-bold text-primary leading-tight">
                    {order.civilite} {order.nomClient}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-lg text-slate-900">{order.montantTotal} F</div>
                  <div className={`text-xs font-bold ${order.resteAPayer > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {order.resteAPayer > 0 ? `Reste: ${order.resteAPayer} F` : 'Payé'}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center text-muted-foreground">
                <div className="flex items-center gap-2 text-xs font-medium">
                  {getServiceIcon(order.typeService)}
                  <span>{order.typeService}</span>
                  {order.recuEnvoye && <Mail className="h-3 w-3 text-green-500" />}
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {orders.length === 0 && (
        <div className="h-32 flex items-center justify-center text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
          Aucune commande pour le moment.
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Info className="h-6 w-6 text-primary" />
              Détails Commande #{selectedOrder?.numeroFacture}
            </DialogTitle>
            <DialogDescription>
              Informations complètes de la prestation
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6 py-4">
              {/* Client Info */}
              <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Boutique</p>
                    <p className="font-bold">{selectedOrder.boutiqueSource}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Client</p>
                    <p className="font-bold">{selectedOrder.civilite} {selectedOrder.nomClient}</p>
                    <p className="text-sm text-blue-600 font-medium">{selectedOrder.telephone}</p>
                  </div>
                </div>
              </div>

              {/* Service & Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-xl p-3 space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Service</p>
                  <div className="flex items-center gap-2">
                    {getServiceIcon(selectedOrder.typeService)}
                    <span className="font-bold">{selectedOrder.typeService}</span>
                  </div>
                </div>
                <div className="border rounded-xl p-3 space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Paiement</p>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-slate-500" />
                    <span className="font-bold">{selectedOrder.modePaiement}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-xl p-3 space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Date Dépôt</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="font-bold">{selectedOrder.dateDepot}</span>
                  </div>
                </div>
                <div className="border rounded-xl p-3 space-y-1 bg-primary/5 border-primary/20">
                  <p className="text-[10px] font-black uppercase text-primary/60">Retrait Prévu</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-black text-primary">{selectedOrder.dateRetraitPrevue}</span>
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div className="border-2 border-dashed rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Montant Total</span>
                  <span className="text-xl font-black">{selectedOrder.montantTotal} F</span>
                </div>
                <div className="flex justify-between items-center text-green-600">
                  <span className="text-sm font-medium">Avance Payée</span>
                  <span className="font-bold">-{selectedOrder.avancePayee} F</span>
                </div>
                {selectedOrder.reduction > 0 && (
                  <div className="flex justify-between items-center text-orange-600">
                    <span className="text-sm font-medium">Réduction</span>
                    <span className="font-bold">-{selectedOrder.reduction} F</span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="text-sm font-black uppercase">Reste à Payer</span>
                  <span className={`text-2xl font-black ${selectedOrder.resteAPayer > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {selectedOrder.resteAPayer} FCFA
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  className="bg-green-600 hover:bg-green-700 font-bold gap-2"
                  onClick={() => handleSendReceipt(selectedOrder)}
                >
                  <MessageSquare className="h-4 w-4" /> Reçu WhatsApp
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 font-bold gap-2"
                  onClick={() => handleSendArrival(selectedOrder)}
                >
                  <Store className="h-4 w-4" /> Prêt en Boutique
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between gap-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="font-bold"
                onClick={() => {
                  onEdit(selectedOrder!);
                  setSelectedOrder(null);
                }}
              >
                <Edit className="h-4 w-4 mr-2" /> Modifier
              </Button>
              {isAdmin && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="font-bold"
                  onClick={() => handleDelete(selectedOrder!.id!)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                </Button>
              )}
            </div>
            <Button variant="ghost" onClick={() => setSelectedOrder(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
