import { Order } from '../types';

export const sendWhatsAppReceipt = (order: Order) => {
  const message = `Bonjour ${order.civilite} ${order.nomClient}, La Paix Pressing confirme la réception de votre linge (Facture n°${order.numeroFacture}). Montant : ${order.montantTotal} FCFA. Prévu pour le : ${order.dateRetraitPrevue}.`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${order.telephone.replace(/\s+/g, '')}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
};

export const sendArrivalNotification = (order: Order) => {
  let message = `Bonne nouvelle ${order.civilite} ${order.nomClient} ! Votre commande ${order.numeroFacture} est prête en boutique. Reste à payer : ${order.resteAPayer} FCFA. À très vite !`;

  if (order.reduction > 0) {
    message = `Bonne nouvelle ${order.civilite} ${order.nomClient} ! Votre linge (Facture n°${order.numeroFacture}) est prêt. Le patron vous a accordé une réduction de ${order.reduction} FCFA. Nouveau reste à payer : ${order.resteAPayer} FCFA. À bientôt !`;
  }

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${order.telephone.replace(/\s+/g, '')}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
};
