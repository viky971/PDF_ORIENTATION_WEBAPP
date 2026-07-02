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
        
        // Normalizza la rotazione corrente tra 0 e 360 gradi
        let currentRotation = (page.getRotation()?.angle || 0) % 360;
        if (currentRotation < 0) currentRotation += 360;

        console.log("Pagina", i + 1, { width, height, rotation: currentRotation });

        // Rileva l'orientamento reale geometrico del foglio
        const isLandscape = (currentRotation === 0 || currentRotation === 180)
            ? (width > height)
            : (height > width);

        if (isLandscape) {
            // Calcolo relativo della rotazione per raddrizzare a foglio verticale
            let targetRotation = (currentRotation + 270) % 360;
            page.setRotation(PDFLib.degrees(targetRotation));
        }
    }
    return await pdfDoc.save();
}

// -------------------------------
// ESTRAZIONE PAGINE HD VETTORIALI PER INDESIGN
// -------------------------------
async function exportPagesToImages(file, rangeString) {
    const arrayBuffer = await file.arrayBuffer();
    const mainPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    const totalPages = mainPdfDoc.getPageCount();
    const targetPages = [];
    
    // Parsifica la stringa (es: "1,3-5")
    rangeString.split(",").forEach(part => {
        if (part.includes("-")) {
            const [start, end] = part.split("-").map(n => parseInt(n.trim()));
            for (let i = start; i <= end; i++) targetPages.push(i - 1);
        } else {
            targetPages.push(parseInt(part.trim()) - 1);
        }
    });

    for (const pageIndex of targetPages) {
        if (pageIndex < 0 || pageIndex >= totalPages) continue;

        // Crea un PDF singolo contenente esclusivamente la pagina selezionata
        const tempPdfDoc = await PDFLib.PDFDocument.create();
        const [copiedPage] = await tempPdfDoc.copyPages(mainPdfDoc, [pageIndex]);
        tempPdfDoc.addPage(copiedPage);
        const tempPdfBytes = await tempPdfDoc.save();

        // Genera il download diretto del singolo foglio ad altissima definizione vettoriale (ideale per InDesign)
        const blob = new Blob([tempPdfBytes], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `Pagina_${pageIndex + 1}_AltaDefinizione.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(blobUrl);
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
// ESTRAZIONE IMMAGINI HD (300 DPI EFFETTIVI PER INDESIGN)
// -------------------------------
async function exportPagesToImages(file, rangeString) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const mainPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const totalPages = mainPdfDoc.getPageCount();
        const targetPages = [];
        
        rangeString.split(",").forEach(part => {
            if (part.includes("-")) {
                const [start, end] = part.split("-").map(n => parseInt(n.trim()));
                for (let i = start; i <= end; i++) targetPages.push(i - 1);
            } else {
                targetPages.push(parseInt(part.trim()) - 1);
            }
        });

        for (const pageIndex of targetPages) {
            if (pageIndex < 0 || pageIndex >= totalPages) continue;

            // Crea un mini-PDF temporaneo della singola pagina
            const tempPdfDoc = await PDFLib.PDFDocument.create();
            const [copiedPage] = await tempPdfDoc.copyPages(mainPdfDoc, [pageIndex]);
            tempPdfDoc.addPage(copiedPage);
            const tempPdfBytes = await tempPdfDoc.save();

            const blob = new Blob([tempPdfBytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);

            // Sfrutta l'oggetto Image nativo del browser per renderizzare il PDF
            const img = new Image();
            img.src = blobUrl;

            img.onload = function() {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                // RAPPORTO MATEMATICO: Il PDF nasce a 72 DPI. Moltiplicando per 4.1666 otteniamo 300 DPI reali in pixel
                const scale = 4.166666;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                
                // Disegna l'immagine sul canvas ingrandendola per generare l'alta risoluzione
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = 'high';
                context.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Esporta in PNG ad alta densità (comportamento identico al TIFF in InDesign)
                const imgDataUrl = canvas.toDataURL('image/png');
                
                const link = document.createElement('a');
                link.href = imgDataUrl;
                link.download = `Pagina_${pageIndex + 1}_300dpi.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                URL.revokeObjectURL(blobUrl);
            };

            // Soluzione alternativa se il browser blocca il rendering diretto dell'immagine
            img.onerror = function() {
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `Pagina_${pageIndex + 1}_AltaRisoluzione.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };
        }
    } catch (error) {
        alert(`Errore durante il rendering a 300 DPI: ${error.message}`);
    }
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
// EVENT LISTENERS BLINDATI CON INDICE [0]
// -------------------------------
document.getElementById("autoRotateBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files[0]; // Estrae il file singolo reale

    const pdfBytes = await normalizePdfOrientation(file);
    download(pdfBytes, "PDF_rotato.pdf");
});

document.getElementById("manualRotateBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files[0];

    const page = parseInt(document.getElementById("manualPage").value);
    const degrees = parseInt(document.getElementById("manualDegrees").value);

    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const newPdf = await rotatePage(pdfDoc, page, degrees);
    download(await newPdf.save(), "PDF_ruotato.pdf");
});

document.getElementById("deleteBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files[0];

    const pages = document.getElementById("deletePages").value;
    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const newPdf = await deletePages(pdfDoc, pages);
    download(await newPdf.save(), "PDF_senza_pagine.pdf");
});

document.getElementById("extractBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files[0];

    const pages = document.getElementById("extractPages").value;
    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const newPdf = await extractPages(pdfDoc, pages);
    download(await newPdf.save(), "PDF_estratto.pdf");
});

document.getElementById("extractTiffBtn").addEventListener("click", async () => {
    const input = document.getElementById("pdfInput");
    if (!input.files || input.files.length === 0) return alert("Carica un PDF");
    const file = input.files[0];

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
    const file = input.files[0];

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


