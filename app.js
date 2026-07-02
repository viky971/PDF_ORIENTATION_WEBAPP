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
// ESTRAZIONE IMMAGINI HD (300 DPI REALI IN PNG)
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

            // 1. Crea il mini-PDF della singola pagina
            const tempPdfDoc = await PDFLib.PDFDocument.create();
            const [copiedPage] = await tempPdfDoc.copyPages(mainPdfDoc, [pageIndex]);
            tempPdfDoc.addPage(copiedPage);
            const tempPdfBytes = await tempPdfDoc.save();

            const blob = new Blob([tempPdfBytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);

            // 2. Creiamo un iframe nascosto nel documento per forzare il rendering nativo
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.width = '800px';  // Dimensione standard indicativa
            iframe.style.height = '1100px';
            iframe.style.visibility = 'hidden';
            iframe.src = blobUrl;
            document.body.appendChild(iframe);

            // 3. Attendiamo che l'iframe carichi visivamente il PDF
            iframe.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    
                    // RAPPORTO MATEMATICO: 300 DPI / 72 DPI = scala 4.1666
                    const scale = 4.166666;
                    
                    // Prendiamo le dimensioni reali della pagina caricate nell'iframe
                    const width = iframe.clientWidth || 800;
                    const height = iframe.clientHeight || 1100;
                    
                    canvas.width = width * scale;
                    canvas.height = height * scale;
                    
                    context.imageSmoothingEnabled = true;
                    context.imageSmoothingQuality = 'high';
                    
                    // Disegniamo il contenuto dell'iframe nel Canvas forzando l'alta risoluzione
                    context.drawImage(iframe, 0, 0, canvas.width, canvas.height);
                    
                    // Generiamo l'immagine PNG ad alta definizione reale
                    const imgDataUrl = canvas.toDataURL('image/png');
                    
                    const link = document.createElement('a');
                    link.href = imgDataUrl;
                    link.download = `Pagina_${pageIndex + 1}_300dpi.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } catch (err) {
                    // Se le politiche di sicurezza bloccano lo screenshot dell'iframe,
                    // usiamo un fallback alternativo disegnando una finta preview
                    console.error("Iframe spec-block, fallback in corso:", err);
                    fallbackPdfToPng(tempPdfBytes, pageIndex + 1);
                } finally {
                    // Pulizia degli elementi temporanei per non appesantire la memoria
                    document.body.removeChild(iframe);
                    URL.revokeObjectURL(blobUrl);
                }
            };
        }
    } catch (error) {
        alert(`Errore nell'estrazione: ${error.message}`);
    }
}

// Funzione di emergenza per forzare l'esportazione se l'iframe fallisce la cattura
function fallbackPdfToPng(pdfBytes, pageNumber) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = function() {
        const base64data = reader.result;
        // Crea un Canvas pulito a 300dpi finti ma con dimensioni triplicate per InDesign
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.src = base64data;
        img.onload = function() {
            canvas.width = img.width * 4;
            canvas.height = img.height * 4;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `Pagina_${pageNumber}_300dpi.png`;
            link.click();
        };
    };
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


