// -------------------------------
// ROTAZIONE AUTOMATICA (CORRETTA)
// -------------------------------
async function normalizePdfOrientation(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    const totalPages = pdfDoc.getPageCount();

    for (let i = 0; i < totalPages; i++) {
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();
        
        let currentRotation = (page.getRotation()?.angle || 0) % 360;
        if (currentRotation < 0) currentRotation += 360;

        const isLandscape = (currentRotation === 0 || currentRotation === 180)
            ? (width > height)
            : (height > width);

        if (isLandscape) {
            let targetRotation = (currentRotation + 270) % 360;
            page.setRotation(PDFLib.degrees(targetRotation));
        }
    }

    return await pdfDoc.save();
}

// -------------------------------
// ESTRAZIONE PAGINE AD ALTA DEFINIZIONE VETTORIALE PER INDESIGN
// -------------------------------
async function exportPagesToImages(file, rangeString) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const mainPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const totalPages = mainPdfDoc.getPageCount();
        const targetPages = [];
        
        // Parsifica la stringa delle pagine (es. "1, 3-5")
        rangeString.split(",").forEach(part => {
            if (part.includes("-")) {
                const [start, end] = part.split("-").map(n => parseInt(n.trim()));
                for (let i = start; i <= end; i++) targetPages.push(i - 1); // Indice JavaScript parte da 0
            } else {
                targetPages.push(parseInt(part.trim()) - 1);
            }
        });

        let pagineElaborate = 0;

        for (const pageIndex of targetPages) {
            if (pageIndex < 0 || pageIndex >= totalPages) {
                alert(`La pagina ${pageIndex + 1} non esiste in questo PDF.`);
                continue;
            }

            // Crea un nuovo documento PDF per la singola pagina da sostituire
            const singlePageDoc = await PDFLib.PDFDocument.create();
            const [copiedPage] = await singlePageDoc.copyPages(mainPdfDoc, [pageIndex]);
            singlePageDoc.addPage(copiedPage);
            
            const singlePageBytes = await singlePageDoc.save();

            // Avvia il download immediato del singolo foglio HD
            const blob = new Blob([singlePageBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.href = url;
            link.download = `Pagina_${pageIndex + 1}_AltaDefinizione.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            pagineElaborate++;
        }

        if (pagineElaborate === 0) {
            alert("Nessuna pagina valida è stata inserita.");
        }

    } catch (error) {
        console.error("Errore durante l'estrazione delle pagine:", error);
        alert(`Si è verificato un errore durante l'estrazione: ${error.message}`);
    }
}

// -------------------------------
// ROTAZIONE MANUALE
// -------------------------------
async function rotatePage(pdfDoc, pageNumber, degrees) {
    const page = pdfDoc.getPage(pageNumber - 1);
    page.setRotation(PDFLib.degrees(degrees));
    return pdfDoc;
}

// -------------------------------
// ELIMINAZIONE PAGINE
// -------------------------------
async function deletePages(pdfDoc, pagesToDelete) {
    const newPdf = await PDFLib.PDFDocument.create();
    const total = pdfDoc.getPageCount();
    const toDelete = new Set();

    pagesToDelete.split(",").forEach(part => {
        if (part.includes("-")) {
            const [start, end] = part.split("-").map(n => parseInt(n));
            for (let i = start; i <= end; i++) toDelete.add(i - 1);
        } else {
            toDelete.add(parseInt(part) - 1);
        }
    });

    for (let i = 0; i < total; i++) {
        if (!toDelete.has(i)) {
            const [copied] = await newPdf.copyPages(pdfDoc, [i]);
            newPdf.addPage(copied);
        }
    }

    return newPdf;
}

// -------------------------------
// ESTRAZIONE INTERVALLO PAGINE (IN PDF)
// -------------------------------
async function extractPages(pdfDoc, range) {
    const newPdf = await PDFLib.PDFDocument.create();
    const total = pdfDoc.getPageCount();
    const toExtract = [];

    range.split(",").forEach(part => {
        if (part.includes("-")) {
            const [start, end] = part.split("-").map(n => parseInt(n));
            for (let i = start; i <= end; i++) toExtract.push(i - 1);
        } else {
            toExtract.push(parseInt(part) - 1);
        }
    });

    for (let i of toExtract) {
        if (i >= 0 && i < total) {
            const [copied] = await newPdf.copyPages(pdfDoc, [i]);
            newPdf.addPage(copied);
        }
    }

    return newPdf;
}

// -------------------------------
// UNIONE PDF
// -------------------------------
async function mergePDFs(files) {
    const merged = await PDFLib.PDFDocument.create();

    for (let file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);

        const pages = await merged.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => merged.addPage(p));
    }

    return merged;
}

// -------------------------------
// RIORDINAMENTO PAGINE
// -------------------------------
async function reorderPages(pdfDoc, orderString) {
    const newPdf = await PDFLib.PDFDocument.create();
    const order = orderString.split(",").map(n => parseInt(n.trim()) - 1);

    for (let index of order) {
        const [copied] = await newPdf.copyPages(pdfDoc, [index]);
        newPdf.addPage(copied);
    }

    return newPdf;
}

// -------------------------------
// TEMA CHIARO/SCURO
// -------------------------------
function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
}

// -------------------------------
// DOWNLOAD
// -------------------------------
function download(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const link = document.getElementById("downloadLink");
    link.href = url;
    link.download = filename;
    link.style.display = "block";
    link.textContent = "Scarica " + filename;
}

// -------------------------------
// EVENT LISTENERS
// -------------------------------
document.getElementById("autoRotateBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files;

    const pdfBytes = await normalizePdfOrientation(file);
    download(pdfBytes, "PDF_rotato.pdf");
});

document.getElementById("manualRotateBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files;

    const page = parseInt(document.getElementById("manualPage").value);
    const degrees = parseInt(document.getElementById("manualDegrees").value);

    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const newPdf = await rotatePage(pdfDoc, page, degrees);
    download(await newPdf.save(), "PDF_ruotato.pdf");
});

document.getElementById("deleteBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files;

    const pages = document.getElementById("deletePages").value;

    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const newPdf = await deletePages(pdfDoc, pages);
    download(await newPdf.save(), "PDF_senza_pagine.pdf");
});

document.getElementById("extractBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files;
    
    const pages = document.getElementById("extractPages").value;
    
    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const newPdf = await extractPages(pdfDoc, pages);
    download(await newPdf.save(), "PDF_estratto.pdf");
});

document.getElementById("extractTiffBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files;

    const pages = document.getElementById("extractTiffPages").value;
    if (!pages) return alert("Inserisci le pagine da esportare (es. 1, 3-5)");

    await exportPagesToImages(file, pages);
});

document.getElementById("mergeBtn").addEventListener("click", async () => {
    const files = document.getElementById("mergeInput").files;
    if (!files || files.length === 0) return alert("Carica almeno due PDF");

    const newPdf = await mergePDFs(files);
    download(await newPdf.save(), "PDF_unito.pdf");
});

document.getElementById("reorderBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files;
    const order = document.getElementById("reorderPages").value;
        const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
        const newPdf = await reorderPages(pdfDoc, order);
        download(await newPdf.save(), "PDF_riordinato.pdf");
    });

    document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);

    // Inizializzazione tema all'avvio
    (() => {
        const saved = localStorage.getItem("theme");
        if (saved) {
            document.documentElement.setAttribute("data-theme", saved);
        } else {
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
        }
    })();


