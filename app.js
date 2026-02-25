async function normalizePdfOrientation(file, startPage = 1, endPage = null) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

    const totalPages = pdfDoc.getPageCount();
    const lastPage = endPage ? Math.min(endPage, totalPages) : totalPages;

    for (let i = startPage - 1; i < lastPage; i++) {
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();

        if (width > height) {
            page.setRotation(-90 * (Math.PI / 180));
        }
    }

    return await pdfDoc.save();
}

document.getElementById("processBtn").addEventListener("click", async () => {
    const file = document.getElementById("pdfInput").files[0];
    if (!file) {
        alert("Carica un PDF");
        return;
    }

    const startPage = parseInt(document.getElementById("startPage").value);
    const endPage = parseInt(document.getElementById("endPage").value);

    const pdfBytes = await normalizePdfOrientation(file, startPage, endPage);

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const link = document.getElementById("downloadLink");
    link.href = url;
    link.download = "PDF_corretto.pdf";
    link.style.display = "block";
    link.textContent = "Scarica PDF Corretto";
});
