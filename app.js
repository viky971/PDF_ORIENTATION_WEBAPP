// -------------------------------
// ROTAZIONE AUTOMATICA
// -------------------------------
async function normalizePdfOrientation(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

    const totalPages = pdfDoc.getPageCount();

    for (let i = 0; i < totalPages; i++) {
        const page = pdfDoc.getPage(i);

        const { width, height } = page.getSize();
        const currentRotation = page.getRotation()?.angle || 0;

        console.log("Pagina", i + 1, {
            width,
            height,
            rotation: currentRotation
        });

        const isLandscapeBySize = width > height;
        const isLandscapeByRotation = currentRotation === 90 || currentRotation === 270;

        const isLandscape = isLandscapeBySize || isLandscapeByRotation;

        if (isLandscape) {
            page.setRotation(PDFLib.degrees(-90)); // rotazione antioraria
        }
    }

    return await pdfDoc.save();
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
// ESTRAZIONE PAGINE
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

function loadTheme() {
    const saved = localStorage.getItem("theme");
    if (saved) {
        document.documentElement.setAttribute("data-theme", saved);
    } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
}

loadTheme();



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
    const file = document.getElementById("pdfInput").files[0];
    if (!file) return alert("Carica un PDF");

    const pdfBytes = await normalizePdfOrientation(file);
    download(pdfBytes, "PDF_rotato.pdf");
});


document.getElementById("manualRotateBtn").addEventListener("click", async () => {
    const file = document.getElementById("pdfInput").files[0];
    if (!file) return alert("Carica un PDF");

    const page = parseInt(document.getElementById("manualPage").value);
    const degrees = parseInt(document.getElementById("manualDegrees").value);

    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const newPdf = await rotatePage(pdfDoc, page, degrees);
    download(await newPdf.save(), "PDF_ruotato.pdf");
});


document.getElementById("deleteBtn").addEventListener("click", async () => {
    const file = document.getElementById("pdfInput").files[0];
    if (!file) return alert("Carica un PDF");

    const pages = document.getElementById("deletePages").value;

    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const newPdf = await deletePages(pdfDoc, pages);
    download(await newPdf.save(), "PDF_senza_pagine.pdf");
});


document.getElementById("extractBtn").addEventListener("click", async () => {
    const file = document.getElementById("pdfInput").files[0];
    if (!file) return alert("Carica un PDF");

    const pages = document.getElementById("extractPages").value;

    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const newPdf = await extractPages(pdfDoc, pages);
    download(await newPdf.save(), "PDF_estratto.pdf");
});


document.getElementById("mergeBtn").addEventListener("click", async () => {
    const files = document.getElementById("mergeInput").files;
    if (!files.length) return alert("Carica almeno due PDF");

    const newPdf = await mergePDFs(files);
    download(await newPdf.save(), "PDF_unito.pdf");
});


document.getElementById("reorderBtn").addEventListener("click", async () => {
    const file = document.getElementById("pdfInput").files[0];
    if (!file) return alert("Carica un PDF");

    const order = document.getElementById("reorderPages").value;

    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const newPdf = await reorderPages(pdfDoc, order);
    download(await newPdf.save(), "PDF_riordinato.pdf");
});


document.getElementById("themeToggle").addEventListener("click", toggleTheme);

