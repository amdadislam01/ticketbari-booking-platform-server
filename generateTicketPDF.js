const PDFDocument = require("pdfkit");

module.exports = function generateTicketPDF(booking, res) {
  const doc = new PDFDocument({ margin: 40 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=ticket-${booking._id}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(24).text("🎟 TicketBari Travel Ticket", { align: "center" });
  doc.moveDown(2);

  doc.fontSize(14).text(`Passenger Email: ${booking.userEmail}`);
  doc.text(`Route: ${booking.from} → ${booking.to}`);
  doc.text(`Date: ${new Date(booking.ticketDate).toDateString()}`);
  doc.text(`Time: ${booking.time}`);
  doc.text(`Tickets: ${booking.quantity}`);
  doc.text(`Total Paid: ${booking.totalPrice} Tk`);
  doc.text(`Status: PAID`);

  doc.moveDown();
  doc.text("Thank you for choosing TicketBari ", { align: "center" });

  doc.end();
};
