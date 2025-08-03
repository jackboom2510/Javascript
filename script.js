document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration Constants ---
    const CELL_SIZE = 50; // Size of each cell in pixels (e.g., 50x50)
    const SCROLL_MARGIN_X = 3; // How many cells from the edge the star/cursor can get before view scrolls (for infinite plane)
    const SCROLL_MARGIN_Y = 3;
    const MAX_HISTORY_STATES = 50;

    // --- DOM Elements ---
    const gridContainer = document.getElementById('grid-container');
    const playModeBtn = document.getElementById('playModeBtn');
    const editModeBtn = document.getElementById('editModeBtn');
    const drawModeBtn = document.getElementById('drawModeBtn');

    // Plane Type Controls
    const infinitePlaneRadio = document.getElementById('infinitePlaneRadio');
    const fixedPlaneRadio = document.getElementById('fixedPlaneRadio');
    const fixedPlaneSizeControls = document.getElementById('fixed-plane-size-controls');
    const fixedWidthInput = document.getElementById('fixedWidthInput');
    const fixedHeightInput = document.getElementById('fixedHeightInput');
    const applyFixedSizeBtn = document.getElementById('applyFixedSizeBtn');

    // Infinite Plane View Controls
    const infinitePlaneViewControls = document.getElementById('infinite-plane-view-controls');
    const infiniteWidthInput = document.getElementById('infiniteWidthInput');
    const infiniteHeightInput = document.getElementById('infiniteHeightInput');
    const applyInfiniteViewBtn = document.getElementById('applyInfiniteViewBtn');

    // --- Core State Variables ---
    let gridData = new Map(); // For 'infinite' plane
    let fixedGrid = []; // For 'fixed' plane (2D array)

    let planeType = 'infinite'; // 'infinite' or 'fixed'
    let fixedGridWidth = parseInt(fixedWidthInput.value); // Initial values from HTML
    let fixedGridHeight = parseInt(fixedHeightInput.value);

    // Dynamic Infinite View Size (will be set by resizeGridToFitScreen initially)
    let infiniteViewWidthCells = parseInt(infiniteWidthInput.value);
    let infiniteViewHeightCells = parseInt(infiniteHeightInput.value);

    let starX = 0; // Star's logical position (starts at 0,0 for infinite, center for fixed)
    let starY = 0;

    let editCursorX = 0; // Edit cursor's logical position
    let editCursorY = 0;

    // --- Mode States ---
    const MODES = ['play', 'edit', 'draw'];
    let currentMode = MODES[0]; // Start in 'play' mode

    // --- Viewport/Scrolling Variables (only for 'infinite' plane) ---
    let viewOffsetX = 0;
    let viewOffsetY = 0;
    let isDragging = false; // For viewport drag
    let lastMouseX, lastMouseY; // For viewport drag

    // --- New: Drag-and-Drop State Variables for Star/Cursor ---
    let isStarDragging = false;
    let dragStartGridX = 0;
    let dragStartGridY = 0;
    let originalGridState = null; // Store a copy of the grid before dragging starts
    let dragPathCells = new Map(); // Store cells touched during a drag for infinite plane
    let dragPathFixedCells = []; // Store cells touched during a drag for fixed plane


    // --- History Management Variables ---
    let history = [];
    let historyPointer = -1;

    // --- Global variable to store the initial default state ---
    // This will be populated once after initial setup
    let initialDefaultState;

    // --- History Management Functions ---
    function saveState() {
        if (historyPointer < history.length - 1) {
            history = history.slice(0, historyPointer + 1);
        }

        const serializableGridData = {};
        gridData.forEach((value, key) => {
            serializableGridData[key] = value;
        });

        const currentState = {
            gridData: serializableGridData,
            fixedGrid: JSON.parse(JSON.stringify(fixedGrid)), // Deep copy fixedGrid
            starX: starX,
            starY: starY,
            editCursorX: editCursorX,
            editCursorY: editCursorY,
            currentMode: currentMode,
            planeType: planeType,
            fixedGridWidth: fixedGridWidth,
            fixedGridHeight: fixedGridHeight,
            infiniteViewWidthCells: infiniteViewWidthCells,
            infiniteViewHeightCells: infiniteViewHeightCells,
            viewOffsetX: viewOffsetX,
            viewOffsetY: viewOffsetY
        };

        history.push(currentState);
        historyPointer++;

        if (history.length > MAX_HISTORY_STATES) {
            history.shift();
            historyPointer--;
        }
    }

    function loadState(state) {
        gridData = new Map(Object.entries(state.gridData || {}));
        fixedGrid = JSON.parse(JSON.stringify(state.fixedGrid || []));
        starX = state.starX;
        starY = state.starY;
        editCursorX = state.editCursorX;
        editCursorY = state.editCursorY;
        currentMode = state.currentMode;
        planeType = state.planeType;
        fixedGridWidth = state.fixedGridWidth;
        fixedGridHeight = state.fixedGridHeight;
        infiniteViewWidthCells = state.infiniteViewWidthCells || parseInt(infiniteWidthInput.value); // Fallback to initial HTML value
        infiniteViewHeightCells = state.infiniteViewHeightCells || parseInt(infiniteHeightInput.value); // Fallback to initial HTML value
        viewOffsetX = state.viewOffsetX;
        viewOffsetY = state.viewOffsetY;

        updatePlaneTypeControls();
        updateModeButtonHighlight();
        initializeGridDisplay(); // Re-initialize grid container based on loaded state
        renderGrid();
    }

    function undo() {
        if (historyPointer > 0) {
            historyPointer--;
            loadState(history[historyPointer]);
        } else {
            console.log("No more undo states.");
        }
    }

    function redo() {
        if (historyPointer < history.length - 1) {
            historyPointer++;
            loadState(history[historyPointer]);
        } else {
            console.log("No more redo states.");
        }
    }
    // --- End History Management Functions ---

    // --- Reset to Default State ---
    function resetToDefaultState() {
        if (!initialDefaultState) {
            console.warn("initialDefaultState not captured yet. Cannot reset.");
            return;
        }

        planeType = initialDefaultState.planeType;
        fixedGridWidth = initialDefaultState.fixedGridWidth;
        fixedGridHeight = initialDefaultState.fixedGridHeight;
        starX = initialDefaultState.starX;
        starY = initialDefaultState.starY;
        editCursorX = initialDefaultState.editCursorX;
        editCursorY = initialDefaultState.editCursorY;
        currentMode = initialDefaultState.currentMode;
        viewOffsetX = initialDefaultState.viewOffsetX;
        viewOffsetY = initialDefaultState.viewOffsetY;

        gridData = new Map(initialDefaultState.gridData);
        fixedGrid = JSON.parse(JSON.stringify(initialDefaultState.fixedGrid));

        resizeGridToFitScreen();
        updatePlaneTypeControls();
        updateModeButtonHighlight();
        synchronizeCursorStar();
        saveState();
    }

    // --- Resize Grid to Fit Screen ---
    function resizeGridToFitScreen() {
        const controlsPanelWidth = 280;
        const mainContentAreaPadding = 20;

        const availableWidth = window.innerWidth - controlsPanelWidth - (mainContentAreaPadding * 2);
        const availableHeight = window.innerHeight - (mainContentAreaPadding * 2);

        if (planeType === 'infinite') {
            const newInfiniteViewWidth = Math.max(5, Math.floor(availableWidth / CELL_SIZE));
            const newInfiniteViewHeight = Math.max(5, Math.floor(availableHeight / CELL_SIZE));

            if (infiniteViewWidthCells !== newInfiniteViewWidth || infiniteViewHeightCells !== newInfiniteViewHeight) {
                infiniteViewWidthCells = newInfiniteViewWidth;
                infiniteViewHeightCells = newInfiniteViewHeight;
                adjustViewToTarget(currentMode === 'play' ? starX : editCursorX, currentMode === 'play' ? starY : editCursorY);
            }
        }

        initializeGridDisplay();
        renderGrid();
    }


    // --- UI/Mode Functions ---
    function updateModeButtonHighlight() {
        playModeBtn.classList.remove('active-mode');
        editModeBtn.classList.remove('active-mode');
        drawModeBtn.classList.remove('active-mode');

        if (currentMode === 'play') {
            playModeBtn.classList.add('active-mode');
        } else if (currentMode === 'edit') {
            editModeBtn.classList.add('active-mode');
        } else if (currentMode === 'draw') {
            drawModeBtn.classList.add('active-mode');
        }
    }

    function setMode(newMode) {
        if (!MODES.includes(newMode) || currentMode === newMode) {
            return;
        }
        currentMode = newMode;
        synchronizeCursorStar();
        renderGrid();
        updateModeButtonHighlight();
        saveState();
    }

    function synchronizeCursorStar() {
        if (planeType === 'fixed') {
            starX = Math.min(Math.max(0, starX), fixedGridWidth - 1);
            starY = Math.min(Math.max(0, starY), fixedGridHeight - 1);
            editCursorX = Math.min(Math.max(0, editCursorX), fixedGridWidth - 1);
            editCursorY = Math.min(Math.max(0, editCursorY), fixedGridHeight - 1);
        }

        if (currentMode === 'edit' || currentMode === 'draw') {
            editCursorX = starX;
            editCursorY = starY;
            if (currentMode === 'draw') {
                if (planeType === 'infinite') {
                    gridData.set(`${starY},${starX}`, 1);
                } else {
                    if (starY >= 0 && starY < fixedGridHeight && starX >= 0 && starX < fixedGridWidth) {
                        fixedGrid[starY][starX] = 1;
                    }
                }
            }
        } else {
            starX = editCursorX;
            starY = editCursorY;
        }

        if (planeType === 'infinite') {
            adjustViewToTarget(currentMode === 'play' ? starX : editCursorX, currentMode === 'play' ? starY : editCursorY);
        }
    }

    function updatePlaneTypeControls() {
        infinitePlaneRadio.checked = (planeType === 'infinite');
        fixedPlaneRadio.checked = (planeType === 'fixed');

        fixedPlaneSizeControls.style.display = (planeType === 'fixed') ? 'flex' : 'none';
        infinitePlaneViewControls.style.display = (planeType === 'infinite') ? 'flex' : 'none';

        fixedWidthInput.value = fixedGridWidth;
        fixedHeightInput.value = fixedGridHeight;
        infiniteWidthInput.value = infiniteViewWidthCells;
        infiniteHeightInput.value = infiniteViewHeightCells;
    }

    function setPlaneType(newType) {
        if (planeType === newType) return;

        planeType = newType;
        initializeGridDisplay();
        synchronizeCursorStar();
        renderGrid();
        updatePlaneTypeControls();
        saveState();
    }

    function applyFixedGridSize() {
        let newWidth = parseInt(fixedWidthInput.value);
        let newHeight = parseInt(fixedHeightInput.value);

        if (isNaN(newWidth) || newWidth < 5 || newWidth > 100 ||
            isNaN(newHeight) || newHeight < 5 || newHeight > 100) {
            alert("For Fixed Grid: Please enter valid width and height between 5 and 100.");
            return;
        }

        fixedGridWidth = newWidth;
        fixedGridHeight = newHeight;

        fixedGrid = Array(fixedGridHeight).fill(null).map(() => Array(fixedGridWidth).fill(0));
        starX = Math.floor(fixedGridWidth / 2);
        starY = Math.floor(fixedGridHeight / 2);
        editCursorX = starX;
        editCursorY = starY;
        fixedGrid[starY][starX] = 1;

        initializeGridDisplay();
        renderGrid();
        saveState();
    }

    function applyInfiniteViewSize() {
        let newWidth = parseInt(infiniteWidthInput.value);
        let newHeight = parseInt(infiniteHeightInput.value);

        if (isNaN(newWidth) || newWidth < 5 || newWidth > 50 ||
            isNaN(newHeight) || newHeight < 5 || newHeight > 50) {
            alert("For Infinite View: Please enter valid width and height between 5 and 50.");
            return;
        }

        infiniteViewWidthCells = newWidth;
        infiniteViewHeightCells = newHeight;

        initializeGridDisplay();
        renderGrid();
        saveState();
    }

    function initializeGridDisplay() {
        if (planeType === 'infinite') {
            gridContainer.style.width = `${infiniteViewWidthCells * CELL_SIZE}px`;
            gridContainer.style.height = `${infiniteViewHeightCells * CELL_SIZE}px`;
            gridContainer.style.gridTemplateColumns = `repeat(${infiniteViewWidthCells}, ${CELL_SIZE}px)`;
            gridContainer.style.gridTemplateRows = `repeat(${infiniteViewHeightCells}, ${CELL_SIZE}px)`;
            gridContainer.style.cursor = 'grab';
            gridContainer.style.userSelect = 'none';
            gridContainer.style.touchAction = 'none';
        } else { // fixed
            gridContainer.style.width = `${fixedGridWidth * CELL_SIZE}px`;
            gridContainer.style.height = `${fixedGridHeight * CELL_SIZE}px`;
            gridContainer.style.gridTemplateColumns = `repeat(${fixedGridWidth}, ${CELL_SIZE}px)`;
            gridContainer.style.gridTemplateRows = `repeat(${fixedGridHeight}, ${CELL_SIZE}px)`;
            gridContainer.style.cursor = 'default';
            gridContainer.style.userSelect = 'auto';
            gridContainer.style.touchAction = 'auto';
        }
    }

    function adjustViewToTarget(targetX, targetY) {
        if (planeType !== 'infinite') return;

        const relativeX = targetX - viewOffsetX;
        const relativeY = targetY - viewOffsetY;

        if (relativeX < SCROLL_MARGIN_X) {
            viewOffsetX = targetX - SCROLL_MARGIN_X;
        } else if (relativeX >= infiniteViewWidthCells - SCROLL_MARGIN_X) {
            viewOffsetX = targetX - (infiniteViewWidthCells - SCROLL_MARGIN_X);
        }

        if (relativeY < SCROLL_MARGIN_Y) {
            viewOffsetY = targetY - SCROLL_MARGIN_Y;
        } else if (relativeY >= infiniteViewHeightCells - SCROLL_MARGIN_Y) {
            viewOffsetY = targetY - (infiniteViewHeightCells - SCROLL_MARGIN_Y);
        }
    }

    function forceCenterViewOn(targetX, targetY) {
        if (planeType !== 'infinite') return;

        viewOffsetX = targetX - Math.floor(infiniteViewWidthCells / 2);
        viewOffsetY = targetY - Math.floor(infiniteViewHeightCells / 2);
        renderGrid();
    }

    // --- Grid Rendering ---
    function renderGrid() {
        gridContainer.innerHTML = '';

        let startCol, endCol, startRow, endRow;
        let activeGridData;

        if (planeType === 'infinite') {
            startCol = viewOffsetX;
            endCol = viewOffsetX + infiniteViewWidthCells;
            startRow = viewOffsetY;
            endRow = viewOffsetY + infiniteViewHeightCells;
            activeGridData = gridData;
        } else { // fixed plane
            startCol = 0;
            endCol = fixedGridWidth;
            startRow = 0;
            endRow = fixedGridHeight;
            activeGridData = fixedGrid;
        }

        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                const cell = document.createElement('div');
                cell.classList.add('grid-cell');
                cell.dataset.logicalRow = r;
                cell.dataset.logicalCol = c;

                let cellState;
                if (planeType === 'infinite') {
                    cellState = activeGridData.get(`${r},${c}`) || 0;
                } else {
                    if (r >= 0 && r < fixedGridHeight && c >= 0 && c < fixedGridWidth) {
                        cellState = activeGridData[r][c] || 0;
                    } else {
                        cellState = 0; // Out of bounds for fixed grid, treat as gray
                    }
                }

                if (cellState === 0) {
                    cell.classList.add('gray');
                } else if (cellState === 1) {
                    cell.classList.add('moveable');
                }

                // Attach click listener for toggling cell state (not drag)
                cell.addEventListener('click', (event) => {
                    if (event.target.classList.contains('arrow') || isStarDragging) { // Ignore if clicking arrow or dragging
                        return;
                    }
                    if (currentMode !== 'play') {
                        // In edit or draw mode, clicking toggles cell state
                        if (planeType === 'infinite') {
                            activeGridData.set(`${r},${c}`, (activeGridData.get(`${r},${c}`) || 0) === 0 ? 1 : 0);
                        } else {
                            if (r >= 0 && r < fixedGridHeight && c >= 0 && c < fixedGridWidth) {
                                activeGridData[r][c] = (activeGridData[r][c] === 0) ? 1 : 0;
                            }
                        }
                        saveState();
                        renderGrid();
                    }
                });


                // Display star
                if (r === starY && c === starX) {
                    cell.classList.add('star-cell');
                    if (currentMode === 'play') { // Only show arrows in play mode
                        const arrows = ['&uarr;', '&darr;', '&larr;', '&rarr;'];
                        const arrowClasses = ['up', 'down', 'left', 'right'];

                        arrows.forEach((arrowHtml, index) => {
                            const arrow = document.createElement('div');
                            arrow.classList.add('arrow', arrowClasses[index]);
                            arrow.innerHTML = arrowHtml;
                            arrow.addEventListener('click', (event) => {
                                event.stopPropagation(); // Prevent cell click from firing
                                moveStar(arrowClasses[index]);
                            });
                            cell.appendChild(arrow);
                        });
                    }
                }

                // Display edit cursor
                if ((currentMode === 'edit' || currentMode === 'draw') && r === editCursorY && c === editCursorX) {
                    cell.classList.add('edit-selection-border');
                    // Add drag listeners ONLY to the cursor cell in edit/draw mode
                    if (currentMode !== 'play') {
                        cell.addEventListener('mousedown', startStarDrag);
                    }
                }

                gridContainer.appendChild(cell);
            }
        }
    }

    // --- Movement Functions ---
    function moveStar(direction) {
        let newStarX = starX;
        let newStarY = starY;

        switch (direction) {
            case 'up': newStarY--; break;
            case 'down': newStarY++; break;
            case 'left': newStarX--; break;
            case 'right': newStarX++; break;
        }

        let canMove = false;
        if (planeType === 'infinite') {
            canMove = gridData.get(`${newStarY},${newStarX}`) === 1;
        } else {
            if (newStarX >= 0 && newStarX < fixedGridWidth &&
                newStarY >= 0 && newStarY < fixedGridHeight) {
                canMove = fixedGrid[newStarY][newStarX] === 1;
            }
        }

        if (canMove) {
            starX = newStarX;
            starY = newStarY;
            if (planeType === 'infinite') {
                adjustViewToTarget(starX, starY);
            }
            saveState();
            renderGrid();
        } else {
            console.log("Cannot move to an unmoveable (gray) cell or out of bounds!");
        }
    }

    function moveEditCursor(direction) {
        let newCursorX = editCursorX;
        let newCursorY = editCursorY;

        switch (direction) {
            case 'up': newCursorY--; break;
            case 'down': newCursorY++; break;
            case 'left': newCursorX--; break;
            case 'right': newCursorX++; break;
        }

        if (planeType === 'fixed') {
            newCursorX = Math.min(Math.max(0, newCursorX), fixedGridWidth - 1);
            newCursorY = Math.min(Math.max(0, newCursorY), fixedGridHeight - 1);
        }

        editCursorX = newCursorX;
        editCursorY = newCursorY;

        if (currentMode === 'draw') {
            starX = newCursorX;
            starY = newCursorY;
            if (planeType === 'infinite') {
                gridData.set(`${editCursorY},${editCursorX}`, 1);
            } else {
                if (editCursorX >= 0 && editCursorX < fixedGridWidth &&
                    editCursorY >= 0 && editCursorY < fixedGridHeight) {
                    fixedGrid[editCursorY][editCursorX] = 1;
                }
            }
        }

        if (planeType === 'infinite') {
            adjustViewToTarget(editCursorX, editCursorY);
        }
        saveState();
        renderGrid();
    }

    // --- Drag-and-Drop Functions for Star/Cursor ---
    function startStarDrag(e) {
        if (e.button !== 0 || currentMode === 'play') return; // Only left-click and not in play mode

        isStarDragging = true;
        dragStartGridX = editCursorX;
        dragStartGridY = editCursorY;

        // Save a copy of the current grid state *before* any changes are made during the drag
        if (planeType === 'infinite') {
            originalGridState = new Map(gridData);
            dragPathCells.clear(); // Clear any previous drag path
        } else {
            originalGridState = JSON.parse(JSON.stringify(fixedGrid));
            dragPathFixedCells = []; // Clear any previous drag path
        }

        // Initially mark the starting cell as moveable
        if (planeType === 'infinite') {
            gridData.set(`${dragStartGridY},${dragStartGridX}`, 1);
            dragPathCells.set(`${dragStartGridY},${dragStartGridX}`, true);
        } else {
            if (dragStartGridY >= 0 && dragStartGridY < fixedGridHeight &&
                dragStartGridX >= 0 && dragStartGridX < fixedGridWidth) {
                fixedGrid[dragStartGridY][dragStartGridX] = 1;
                dragPathFixedCells.push({ x: dragStartGridX, y: dragStartGridY });
            }
        }

        gridContainer.style.cursor = 'grabbing';
        renderGrid(); // Render to show the initial moveable cell
        e.preventDefault(); // Prevent default browser drag behavior
    }

    function onStarDrag(e) {
        if (!isStarDragging) return;

        // Calculate grid coordinates from mouse position
        const rect = gridContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let currentGridX = Math.floor(mouseX / CELL_SIZE);
        let currentGridY = Math.floor(mouseY / CELL_SIZE);

        if (planeType === 'infinite') {
            currentGridX += viewOffsetX;
            currentGridY += viewOffsetY;
        } else {
            // Constrain to fixed grid bounds
            currentGridX = Math.min(Math.max(0, currentGridX), fixedGridWidth - 1);
            currentGridY = Math.min(Math.max(0, currentGridY), fixedGridHeight - 1);
        }

        // Only update if the cursor has moved to a new cell
        if (editCursorX !== currentGridX || editCursorY !== currentGridY) {
            editCursorX = currentGridX;
            editCursorY = currentGridY;

            // Update star position to follow cursor in draw mode
            if (currentMode === 'draw') {
                starX = editCursorX;
                starY = editCursorY;
            }

            // Mark the current cell as moveable if in draw or edit mode
            if (planeType === 'infinite') {
                gridData.set(`${editCursorY},${editCursorX}`, 1);
                dragPathCells.set(`${editCursorY},${editCursorX}`, true);
            } else {
                if (editCursorY >= 0 && editCursorY < fixedGridHeight &&
                    editCursorX >= 0 && editCursorX < fixedGridWidth) {
                    fixedGrid[editCursorY][editCursorX] = 1;
                    dragPathFixedCells.push({ x: editCursorX, y: editCursorY });
                }
            }

            if (planeType === 'infinite') {
                adjustViewToTarget(editCursorX, editCursorY);
            }
            renderGrid();
        }
    }

    function endStarDrag(e) {
        if (!isStarDragging) return;
        isStarDragging = false;
        gridContainer.style.cursor = 'grab'; // Reset cursor

        // Clear the old trail and apply only the new path
        if (planeType === 'infinite') {
            // Revert to original grid state first
            gridData = new Map(originalGridState);
            // Then apply only the cells touched during this drag
            dragPathCells.forEach((value, key) => {
                gridData.set(key, 1);
            });
            dragPathCells.clear(); // Clear the drag path
        } else {
            fixedGrid = JSON.parse(JSON.stringify(originalGridState));
            dragPathFixedCells.forEach(cell => {
                if (cell.y >= 0 && cell.y < fixedGridHeight && cell.x >= 0 && cell.x < fixedGridWidth) {
                    fixedGrid[cell.y][cell.x] = 1;
                }
            });
            dragPathFixedCells = [];
        }

        originalGridState = null; // Clear original state
        saveState(); // Save the final state after drag
        renderGrid(); // Final render
    }


    // --- Event Listeners ---
    // Mode buttons
    playModeBtn.addEventListener('click', () => setMode('play'));
    editModeBtn.addEventListener('click', () => setMode('edit'));
    drawModeBtn.addEventListener('click', () => setMode('draw'));

    // Plane type radio buttons
    infinitePlaneRadio.addEventListener('change', () => setPlaneType('infinite'));
    fixedPlaneRadio.addEventListener('change', () => setPlaneType('fixed'));
    applyFixedSizeBtn.addEventListener('click', applyFixedGridSize);
    applyInfiniteViewBtn.addEventListener('click', applyInfiniteViewSize);

    // Keyboard input handling
    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();

        // Global shortcuts (undo/redo, center view)
        if (event.ctrlKey || event.metaKey) {
            if (key === 'z') {
                event.preventDefault();
                undo();
                return;
            }
            if (key === 'y' || (key === 'z' && event.shiftKey)) {
                event.preventDefault();
                redo();
                return;
            }
        }

        if (key === 'c' && planeType === 'infinite') {
            const targetX = (currentMode === 'play') ? starX : editCursorX;
            const targetY = (currentMode === 'play') ? starY : editCursorY;
            forceCenterViewOn(targetX, targetY);
            saveState();
            return;
        }

        if (key === 'r') { // Reset to default state
            event.preventDefault();
            resetToDefaultState();
            return;
        }

        // Tab key for mode cycling
        if (key === 'tab') {
            event.preventDefault(); // Prevent default tab behavior (focus change)
            const currentIndex = MODES.indexOf(currentMode);
            const nextIndex = (currentIndex + 1) % MODES.length;
            setMode(MODES[nextIndex]);
            return;
        }

        // Mode-specific controls (excluding drag, which is handled by mouse events)
        if (!isStarDragging && !isDragging) { // Only process if not dragging
            if (currentMode === 'play') {
                switch (key) {
                    case 'w': case 'arrowup': moveStar('up'); break;
                    case 's': case 'arrowdown': moveStar('down'); break;
                    case 'a': case 'arrowleft': moveStar('left'); break;
                    case 'd': case 'arrowright': moveStar('right'); break;
                }
            } else if (currentMode === 'edit' || currentMode === 'draw') {
                switch (key) {
                    case 'w': case 'arrowup': moveEditCursor('up'); break;
                    case 's': case 'arrowdown': moveEditCursor('down'); break;
                    case 'a': case 'arrowleft': moveEditCursor('left'); break;
                    case 'd': case 'arrowright': moveEditCursor('right'); break;
                    case ' ': // Spacebar to toggle cell state / draw
                        event.preventDefault();
                        let targetR = editCursorY;
                        let targetC = editCursorX;

                        if (planeType === 'infinite') {
                            gridData.set(`${targetR},${targetC}`, (gridData.get(`${targetR},${targetC}`) || 0) === 0 ? 1 : 0);
                        } else {
                            if (targetR >= 0 && targetR < fixedGridHeight && targetC >= 0 && targetC < fixedGridWidth) {
                                fixedGrid[targetR][targetC] = (fixedGrid[targetR][targetC] === 0) ? 1 : 0;
                            }
                        }
                        saveState();
                        renderGrid();
                        break;
                    case '1':
                    case '2':
                        if (currentMode === 'edit') {
                            let targetR = editCursorY;
                            let targetC = editCursorX;
                            let currentState;

                            if (planeType === 'infinite') {
                                currentState = gridData.get(`${targetR},${targetC}`) || 0;
                                gridData.set(`${targetR},${targetC}`, (currentState === 1) ? 0 : 1);
                            } else {
                                if (targetR >= 0 && targetR < fixedGridHeight && targetC >= 0 && targetC < fixedGridWidth) {
                                    currentState = fixedGrid[targetR][targetC] || 0;
                                    fixedGrid[targetR][targetC] = (currentState === 1) ? 0 : 1;
                                }
                            }
                            saveState();
                            renderGrid();
                        }
                        break;
                    case '3':
                        if (currentMode === 'edit') {
                            let targetR = editCursorY;
                            let targetC = editCursorX;
                            if (planeType === 'infinite') {
                                gridData.set(`${targetR},${targetC}`, 0);
                            } else {
                                if (targetR >= 0 && targetR < fixedGridHeight && targetC >= 0 && targetC < fixedGridWidth) {
                                    fixedGrid[targetR][targetC] = 0;
                                }
                            }
                            saveState();
                            renderGrid();
                        }
                        break;
                }
            }
        }
    });

    // Window resize event listener
    window.addEventListener('resize', resizeGridToFitScreen);

    // Mouse dragging for viewport movement (Right Mouse Button) - only for infinite plane
    gridContainer.addEventListener('mousedown', (e) => {
        // Prevent viewport drag if star is being dragged
        if (planeType === 'infinite' && e.button === 2 && !isStarDragging) {
            e.preventDefault();
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            gridContainer.style.cursor = 'grabbing';
        }
    });

    // Global mousemove and mouseup listeners for both viewport drag and star drag
    document.addEventListener('mousemove', (e) => {
        if (isDragging) { // Viewport drag
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;

            viewOffsetX -= Math.round(dx / CELL_SIZE);
            viewOffsetY -= Math.round(dy / CELL_SIZE);

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            renderGrid();
        } else if (isStarDragging) { // Star drag
            onStarDrag(e);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isDragging) { // End viewport drag
            isDragging = false;
            gridContainer.style.cursor = 'grab';
            saveState();
        } else if (isStarDragging) { // End star drag
            endStarDrag(e);
        }
    });

    gridContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // --- Initial Setup ---
    // Initialize initial default state variables based on HTML values and desired defaults
    const initialFixedGridWidth = parseInt(fixedWidthInput.value);
    const initialFixedGridHeight = parseInt(fixedHeightInput.value);
    const initialGridData = new Map([['0,0', 1]]); // Default initial infinite grid with one moveable cell
    const initialFixedGrid = Array(initialFixedGridHeight).fill(null).map(() => Array(initialFixedGridWidth).fill(0));
    initialFixedGrid[Math.floor(initialFixedGridHeight / 2)][Math.floor(initialFixedGridWidth / 2)] = 1; // Mark center of fixed grid

    initialDefaultState = {
        planeType: 'infinite', // Default to infinite plane
        fixedGridWidth: initialFixedGridWidth,
        fixedGridHeight: initialFixedGridHeight,
        infiniteViewWidthCells: parseInt(infiniteWidthInput.value), // Initial value, will be updated by resize
        infiniteViewHeightCells: parseInt(infiniteHeightInput.value), // Initial value, will be updated by resize
        starX: 0, starY: 0, // Default start for infinite plane
        editCursorX: 0, editCursorY: 0, // Default start for infinite plane
        currentMode: MODES[0], // 'play' mode
        viewOffsetX: 0, viewOffsetY: 0, // Initial viewport origin for infinite plane
        gridData: initialGridData,
        fixedGrid: initialFixedGrid
    };

    // Apply the default state to the current state variables
    planeType = initialDefaultState.planeType;
    fixedGridWidth = initialDefaultState.fixedGridWidth;
    fixedGridHeight = initialDefaultState.fixedGridHeight;
    starX = initialDefaultState.starX;
    starY = initialDefaultState.starY;
    editCursorX = initialDefaultState.editCursorX;
    editCursorY = initialDefaultState.editCursorY;
    currentMode = initialDefaultState.currentMode;
    viewOffsetX = initialDefaultState.viewOffsetX;
    viewOffsetY = initialDefaultState.viewOffsetY;
    gridData = new Map(initialDefaultState.gridData); // Use a new Map instance
    fixedGrid = JSON.parse(JSON.stringify(initialDefaultState.fixedGrid)); // Deep copy fixed grid

    // Perform initial resize to fit screen. This will set `infiniteViewWidthCells` and `infiniteViewHeightCells`
    // to match the screen and call initializeGridDisplay() and renderGrid().
    resizeGridToFitScreen();

    // After resize and initial grid setup, ensure star/cursor position and view are correct
    synchronizeCursorStar(); // This will also call adjustViewToTarget/forceCenterViewOn if needed

    updatePlaneTypeControls(); // Update UI for plane type
    updateModeButtonHighlight(); // Update UI for mode highlight
    saveState(); // Save this initial, resized state to history
});