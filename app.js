document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileListContainer = document.getElementById('file-list-container');
    const fileList = document.getElementById('file-list');
    const fileCount = document.getElementById('file-count');
    const clearBtn = document.getElementById('clear-btn');
    const mergeBtn = document.getElementById('merge-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    // State
    let files = [];
    let draggedItemIndex = null;

    // Format file size
    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    // Update UI based on state
    const updateUI = () => {
        if (files.length > 0) {
            fileListContainer.style.display = 'flex';
            fileCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
            mergeBtn.disabled = files.length < 2;
            if (files.length < 2) {
                mergeBtn.title = "Add at least 2 PDFs to merge";
            } else {
                mergeBtn.title = "";
            }
        } else {
            fileListContainer.style.display = 'none';
        }
    };

    // Render file list
    const renderFileList = () => {
        fileList.innerHTML = '';
        
        files.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.draggable = true;
            li.dataset.index = index;
            
            li.innerHTML = `
                <div class="drag-handle">
                    <i class="fa-solid fa-grip-vertical"></i>
                </div>
                <div class="file-icon">
                    <i class="fa-regular fa-file-pdf"></i>
                </div>
                <div class="file-info">
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="file-size">${formatBytes(file.size)}</div>
                </div>
                <button class="remove-btn" data-index="${index}" title="Remove file">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            
            // Drag and drop events for reordering
            li.addEventListener('dragstart', handleDragStart);
            li.addEventListener('dragover', handleDragOver);
            li.addEventListener('drop', handleDrop);
            li.addEventListener('dragend', handleDragEnd);
            
            fileList.appendChild(li);
        });

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                removeFile(index);
            });
        });

        updateUI();
    };

    // Add files to state
    const handleFiles = (newFiles) => {
        const pdfFiles = Array.from(newFiles).filter(file => file.type === 'application/pdf');
        
        if (pdfFiles.length < newFiles.length) {
            alert('Only PDF files are supported. Non-PDF files were ignored.');
        }
        
        files = [...files, ...pdfFiles];
        renderFileList();
    };

    // Remove file from state
    const removeFile = (index) => {
        files.splice(index, 1);
        renderFileList();
    };

    // Clear all files
    const clearAll = () => {
        files = [];
        fileInput.value = '';
        renderFileList();
    };

    // Drag and Drop implementation for the list
    function handleDragStart(e) {
        draggedItemIndex = parseInt(this.dataset.index);
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Required for Firefox
        e.dataTransfer.setData('text/plain', this.dataset.index); 
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const target = e.target.closest('.file-item');
        if (target && target !== this) {
            const bounding = target.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.clientY - offset > 0) {
                target.style.borderBottom = '2px solid var(--primary-color)';
                target.style.borderTop = '';
            } else {
                target.style.borderTop = '2px solid var(--primary-color)';
                target.style.borderBottom = '';
            }
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const target = e.target.closest('.file-item');
        
        // Clear borders
        document.querySelectorAll('.file-item').forEach(item => {
            item.style.borderTop = '';
            item.style.borderBottom = '';
        });

        if (target && draggedItemIndex !== null) {
            const targetIndex = parseInt(target.dataset.index);
            const draggedFile = files[draggedItemIndex];
            
            // Reorder array
            files.splice(draggedItemIndex, 1);
            
            // Determine drop position
            const bounding = target.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            
            if (e.clientY - offset > 0) {
                // Drop after
                files.splice(targetIndex + (draggedItemIndex < targetIndex ? 0 : 1), 0, draggedFile);
            } else {
                // Drop before
                files.splice(targetIndex - (draggedItemIndex < targetIndex ? 1 : 0), 0, draggedFile);
            }
            
            renderFileList();
        }
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        document.querySelectorAll('.file-item').forEach(item => {
            item.style.borderTop = '';
            item.style.borderBottom = '';
        });
        draggedItemIndex = null;
    }

    // Merge PDFs using pdf-lib
    const mergePDFs = async () => {
        if (files.length < 2) return;

        try {
            showLoading('Merging PDFs...');
            const { PDFDocument } = PDFLib;
            const mergedPdf = await PDFDocument.create();

            for (let i = 0; i < files.length; i++) {
                showLoading(`Processing file ${i + 1} of ${files.length}...`);
                const file = files[i];
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            showLoading('Generating final PDF...');
            const mergedPdfFile = await mergedPdf.save();
            
            // Download
            const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `merged_${new Date().getTime()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            hideLoading();
        } catch (error) {
            console.error('Error merging PDFs:', error);
            hideLoading();
            alert('An error occurred while merging the PDFs. Please try again or check your files.');
        }
    };

    // Loading overlay
    const showLoading = (text) => {
        loadingText.textContent = text;
        loadingOverlay.classList.add('active');
    };

    const hideLoading = () => {
        loadingOverlay.classList.remove('active');
    };

    // Event Listeners for Upload Section
    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    });

    // Drag and drop for upload section
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const newFiles = dt.files;
        handleFiles(newFiles);
    });

    // Action buttons
    clearBtn.addEventListener('click', clearAll);
    mergeBtn.addEventListener('click', mergePDFs);

    // Initial UI update
    updateUI();
});
