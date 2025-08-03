document.addEventListener('DOMContentLoaded', () => {
    let CELL_SIZE = 60; // Default cell size in pixels
    let GRID_WIDTH = 15; // Default grid width
    let GRID_HEIGHT = 15; // Default grid height

    const MIN_CELL_SIZE = 60; // Minimum cell size in pixels (Updated to 50)
    const MAX_CELL_SIZE = 200; // Maximum cell size in pixels (New constant)
    const MIN_GRID_DIMENSION = 5; // Minimum grid size (e.g., 5x5)
    const MAX_GRID_DIMENSION = 50; // Maximum grid size (e.g., 50x50)

    // Screen elements
    const setupScreen = document.getElementById('setup-screen');
    const gameScreen = document.getElementById('game-screen');
    const startGameBtn = document.getElementById('startGameBtn');

    // Setup screen controls
    const setupModeControlsContainer = document.getElementById('mode-controls-container-setup');
    const setupGridWidthInput = document.getElementById('setupGridWidthInput');
    const setupGridHeightInput = document.getElementById('setupGridHeightInput');
    const setupSetGridSizeBtn = document.getElementById('setupSetGridSizeBtn');
    const setupFitToScreenBtn = document.getElementById('setupFitToScreenBtn');
    const setupGridContainer = document.getElementById('setup-grid-container');
    const setupXAxisLabels = setupScreen.querySelector('.grid-with-axes-container .x-axis-labels'); 
    const setupYAxisLabels = setupScreen.querySelector('.grid-with-axes-container .y-axis-labels'); 

    // Game screen controls
    const gameModeControlsContainer = document.getElementById('mode-controls-container-game');
    const gridContainer = document.getElementById('grid-container');
    const playModeBtn = document.getElementById('playModeBtn');
    const editModeBtn = document.getElementById('editModeBtn');
    const liveModeBtn = document.getElementById('liveModeBtn');
    const gridWidthInput = document.getElementById('gridWidthInput');
    const gridHeightInput = document.getElementById('gridHeightInput'); 
    const setGridSizeBtn = document.getElementById('setGridSizeBtn');
    const fitToScreenBtn = document.getElementById('fitToScreenBtn');
    const gameXAxisLabels = gameScreen.querySelector('.grid-with-axes-container .x-axis-labels'); 
    const gameYAxisLabels = gameScreen.querySelector('.grid-with-axes-container .y-axis-labels'); 

    // Dark Mode Toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeToggleGame = document.getElementById('darkModeToggleGame'); // Nút cho màn hình game (mới thêm)

    // Game data
    let grid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));

    // Star position (active in Play/Live Mode, static in Edit/Setup)
    let starX = Math.floor(GRID_WIDTH / 2);
    let starY = Math.floor(GRID_HEIGHT / 2);

    // Cursor position (for Edit Mode and Setup Mode's selection)
    let cursorX = Math.floor(GRID_WIDTH / 2);
    let cursorY = Math.floor(GRID_HEIGHT / 2);

    let currentMode = 'setup'; // 'setup', 'play', 'edit', 'live'

    // --- Dark Mode Functionality ---
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        // Save user preference to localStorage
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('darkMode', 'enabled');
        } else {
            localStorage.setItem('darkMode', 'disabled');
        }
    }

    function applySavedDarkModePreference() {
        if (localStorage.getItem('darkMode') === 'enabled') {
            document.body.classList.add('dark-mode');
        }
    }

    // --- Screen Management ---
    function showScreen(screenId) {
        setupScreen.classList.remove('active');
        gameScreen.classList.remove('active');
        document.getElementById(screenId).classList.add('active');
        
        // When switching screens, always try to fit the grid to the available space
        // This ensures the grid adapts correctly to the new layout (e.g., sidebar visibility)
        if (screenId === 'setup-screen') {
            fitGridToScreen(setupGridContainer, true); // true for 'optimal fit'
        } else {
            fitGridToScreen(gridContainer, true); // true for 'optimal fit'
        }
    }

    // --- Grid Size Management ---
    function setGridSize(newWidth, newHeight, targetGridContainer) {
        newWidth = parseInt(newWidth);
        newHeight = parseInt(newHeight);

        // Ensure newWidth and newHeight are within valid range
        if (isNaN(newWidth) || newWidth < MIN_GRID_DIMENSION || newWidth > MAX_GRID_DIMENSION ||
            isNaN(newHeight) || newHeight < MIN_GRID_DIMENSION || newHeight > MAX_GRID_DIMENSION) {
            alert(`Kích thước lưới (Rộng và Cao) phải là số nguyên từ ${MIN_GRID_DIMENSION} đến ${MAX_GRID_DIMENSION}.`);
            // Reset inputs to current GRID_WIDTH/HEIGHT
            if (targetGridContainer === setupGridContainer) {
                setupGridWidthInput.value = GRID_WIDTH;
                setupGridHeightInput.value = GRID_HEIGHT;
            } else {
                gridWidthInput.value = GRID_WIDTH;
                gridHeightInput.value = GRID_HEIGHT;
            }
            return;
        }

        // Only reinitialize grid if dimensions actually change
        const dimensionsChanged = (newWidth !== GRID_WIDTH || newHeight !== GRID_HEIGHT);
        if (dimensionsChanged) {
            GRID_WIDTH = newWidth;
            GRID_HEIGHT = newHeight;
            // Create a new grid array based on the new dimensions
            let newGrid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));
            // Copy existing cell states to the new grid if they fit within new bounds
            for (let r = 0; r < Math.min(grid.length, GRID_HEIGHT); r++) {
                for (let c = 0; c < Math.min(grid[0].length, GRID_WIDTH); c++) {
                    newGrid[r][c] = grid[r][c];
                }
            }
            grid = newGrid;
            
            // Adjust star and cursor positions to new bounds, ensuring they don't go out of bounds
            starX = Math.min(starX, GRID_WIDTH - 1);
            starY = Math.min(starY, GRID_HEIGHT - 1);
            cursorX = Math.min(cursorX, GRID_WIDTH - 1);
            cursorY = Math.min(cursorY, GRID_HEIGHT - 1);
        }
        
        // Always update both input fields to reflect the current GRID_WIDTH/HEIGHT
        setupGridWidthInput.value = GRID_WIDTH;
        setupGridHeightInput.value = GRID_HEIGHT;
        gridWidthInput.value = GRID_WIDTH;
        gridHeightInput.value = GRID_HEIGHT;

        // Re-calculate CELL_SIZE to fit the current GRID_WIDTH/HEIGHT into available space
        // This ensures the grid renders correctly even after manual size change.
        fitGridToScreen(targetGridContainer, false); // Pass false for optimalFit
        // renderGrid is called inside fitGridToScreen now.
    }

    function fitGridToScreen(targetGridContainer, optimalFit = false) {
        const bodyPadding = 40; 

        let sidebarWidth;
        if (targetGridContainer === setupGridContainer) {
            sidebarWidth = setupModeControlsContainer.offsetWidth;
        } else {
            sidebarWidth = gameModeControlsContainer.offsetWidth;
        }

        const axisLabelWidth = 25; 
        const axisLabelHeight = 25; 
        const gapBetweenGridAndSidebar = 20;

        let maxGridContentWidth = window.innerWidth - sidebarWidth - bodyPadding - gapBetweenGridAndSidebar - axisLabelWidth;
        let maxGridContentHeight = window.innerHeight - bodyPadding - axisLabelHeight;

        if (optimalFit) {
            let potentialWidthCells = Math.floor(maxGridContentWidth / MIN_CELL_SIZE);
            let potentialHeightCells = Math.floor(maxGridContentHeight / MIN_CELL_SIZE);

            let idealFitWidth = Math.min(potentialWidthCells, MAX_GRID_DIMENSION);
            let idealFitHeight = Math.min(potentialHeightCells, MAX_GRID_DIMENSION);

            idealFitWidth = Math.max(MIN_GRID_DIMENSION, idealFitWidth);
            idealFitHeight = Math.max(MIN_GRID_DIMENSION, idealFitHeight);

            let temp_CELL_SIZE_W = Math.floor(maxGridContentWidth / idealFitWidth);
            let temp_CELL_SIZE_H = Math.floor(maxGridContentHeight / idealFitHeight);

            CELL_SIZE = Math.min(temp_CELL_SIZE_W, temp_CELL_SIZE_H);
            
            // Apply new cell size limits here
            CELL_SIZE = Math.max(MIN_CELL_SIZE, CELL_SIZE); // Ensure it's not smaller than MIN_CELL_SIZE (50)
            CELL_SIZE = Math.min(MAX_CELL_SIZE, CELL_SIZE); // Ensure it's not larger than MAX_CELL_SIZE (150)

            let newOptimalWidth = Math.floor(maxGridContentWidth / CELL_SIZE);
            let newOptimalHeight = Math.floor(maxGridContentHeight / CELL_SIZE);

            newOptimalWidth = Math.min(newOptimalWidth, MAX_GRID_DIMENSION);
            newOptimalHeight = Math.min(newOptimalHeight, MAX_GRID_DIMENSION);
            
            newOptimalWidth = Math.max(MIN_GRID_DIMENSION, newOptimalWidth);
            newOptimalHeight = Math.max(MIN_GRID_DIMENSION, newOptimalHeight);

            if (newOptimalWidth !== GRID_WIDTH || newOptimalHeight !== GRID_HEIGHT) {
                GRID_WIDTH = newOptimalWidth;
                GRID_HEIGHT = newOptimalHeight;
                // Create a new grid array based on the new dimensions (same logic as in setGridSize)
                let newGrid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));
                for (let r = 0; r < Math.min(grid.length, GRID_HEIGHT); r++) {
                    for (let c = 0; c < Math.min(grid[0].length, GRID_WIDTH); c++) {
                        newGrid[r][c] = grid[r][c];
                    }
                }
                grid = newGrid;
                starX = Math.min(starX, GRID_WIDTH - 1);
                starY = Math.min(starY, GRID_HEIGHT - 1);
                cursorX = Math.min(cursorX, GRID_WIDTH - 1);
                cursorY = Math.min(cursorY, GRID_HEIGHT - 1);

                // Update input fields
                setupGridWidthInput.value = GRID_WIDTH;
                setupGridHeightInput.value = GRID_HEIGHT;
                gridWidthInput.value = GRID_WIDTH;
                gridHeightInput.value = GRID_HEIGHT;
            }
            renderGrid(targetGridContainer);
            return; 
        } else {
            // Default behavior (from setGridSize or window resize)
            let tempCellSize = Math.floor(Math.min(maxGridContentWidth / GRID_WIDTH, maxGridContentHeight / GRID_HEIGHT));
            
            // Apply new cell size limits here as well
            tempCellSize = Math.max(MIN_CELL_SIZE, tempCellSize); // Ensure it's not smaller than MIN_CELL_SIZE (50)
            tempCellSize = Math.min(MAX_CELL_SIZE, tempCellSize); // Ensure it's not larger than MAX_CELL_SIZE (150)

            CELL_SIZE = tempCellSize;
        }
        renderGrid(targetGridContainer);
    }

    // --- UI Update ---
    function updateModeButtonStyles() {
        playModeBtn.classList.remove('active');
        editModeBtn.classList.remove('active');
        liveModeBtn.classList.remove('active');

        if (currentMode === 'play') {
            playModeBtn.classList.add('active');
        } else if (currentMode === 'edit') {
            editModeBtn.classList.add('active');
        } else if (currentMode === 'live') {
            liveModeBtn.classList.add('active');
        }
    }

    // --- Mode Management ---
    function setMode(mode) {
        if (currentMode === mode) return;

        // Logic for transitioning between modes to preserve star/cursor state
        if (mode === 'play') {
            // When entering Play mode, star position is set from cursor's current position
            starX = cursorX;
            starY = cursorY;
        } else if (mode === 'edit') {
            // When entering Edit mode, cursor position is set from star's current position
            cursorX = starX;
            cursorY = starY;
        }
        // When transitioning between Live and Edit (or Play and Live),
        // starX/starY and cursorX/cursorY are NOT explicitly updated here,
        // so their last known positions are preserved.

        currentMode = mode;
        
        updateModeButtonStyles();
        renderGrid(gridContainer);
    }

    // --- Render Axes ---
    function renderAxes(xAxisContainer, yAxisContainer) {
        xAxisContainer.innerHTML = '';
        yAxisContainer.innerHTML = '';

        for (let i = 0; i < GRID_WIDTH; i++) { 
            const xLabel = document.createElement('div');
            xLabel.textContent = i;
            xLabel.style.width = `${CELL_SIZE}px`; 
            xAxisContainer.appendChild(xLabel);
        }

        for (let i = 0; i < GRID_HEIGHT; i++) { 
            const yLabel = document.createElement('div');
            yLabel.textContent = i;
            yLabel.style.height = `${CELL_SIZE}px`; 
            yAxisContainer.appendChild(yLabel);
        }
    }

    // --- Grid Rendering ---
    function renderGrid(targetGrid) {
        if (!targetGrid) return;

        targetGrid.innerHTML = ''; 

        // Call renderAxes before setting grid styles to ensure correct label count
        if (targetGrid === setupGridContainer) {
            renderAxes(setupXAxisLabels, setupYAxisLabels);
        } else {
            renderAxes(gameXAxisLabels, gameYAxisLabels);
        }

        targetGrid.style.gridTemplateColumns = `repeat(${GRID_WIDTH}, ${CELL_SIZE}px)`; 
        targetGrid.style.width = `${GRID_WIDTH * CELL_SIZE + 2}px`; // +2 for borders
        targetGrid.style.height = `${GRID_HEIGHT * CELL_SIZE + 2}px`; // +2 for borders

        for (let r = 0; r < GRID_HEIGHT; r++) { 
            for (let c = 0; c < GRID_WIDTH; c++) { 
                const cell = document.createElement('div');
                cell.classList.add('grid-cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                cell.style.width = `${CELL_SIZE}px`;
                cell.style.height = `${CELL_SIZE}px`;

                // Check grid bounds before accessing grid[r][c]
                if (r < grid.length && c < grid[r].length) {
                    if (grid[r][c] === 0) {
                        cell.classList.add('unmoveable');
                    } else if (grid[r][c] === 1) {
                        cell.classList.add('moveable');
                    } else { // grid[r][c] === 2 (marked)
                        cell.classList.add('marked');
                    }
                } else {
                    cell.classList.add('unmoveable'); 
                }


                cell.addEventListener('click', (event) => {
                    if (event.target.classList.contains('arrow')) {
                        return;
                    }
                    
                    if (currentMode === 'setup') { 
                        starX = c;
                        starY = r;
                        cursorX = c; 
                        cursorY = r;
                        renderGrid(targetGrid);
                        return; 
                    }

                    if (currentMode === 'edit') { 
                        cursorX = c;
                        cursorY = r;
                        if (r < grid.length && c < grid[r].length) {
                             grid[r][c] = (grid[r][c] + 1) % 3; 
                        }
                        renderGrid(targetGrid);
                        return;
                    }

                    if ((currentMode === 'play' || currentMode === 'live') && r === starY && c === starX) {
                        return; 
                    }
                    if (r < grid.length && c < grid[r].length) {
                        grid[r][c] = (grid[r][c] + 1) % 3;
                    }
                    renderGrid(targetGrid);
                });

                if (r === starY && c === starX) {
                    cell.classList.add('star-cell');
                    
                    if ((currentMode === 'play' || currentMode === 'live') && targetGrid === gridContainer) { 
                        const arrows = ['&uarr;', '&darr;', '&larr;', '&rarr;'];
                        const arrowClasses = ['up', 'down', 'left', 'right'];

                        arrows.forEach((arrowHtml, index) => {
                            const arrow = document.createElement('div');
                            arrow.classList.add('arrow', arrowClasses[index]);
                            arrow.innerHTML = arrowHtml;
                            
                            // Relying on CSS font-size for arrow size, adjusting offset only.
                            const arrowOffset = Math.max(8, Math.floor(CELL_SIZE * 0.2)); 

                            // Apply offset directly based on arrowClass
                            if (arrowClasses[index] === 'up') {
                                arrow.style.top = `-${arrowOffset}px`;
                            } else if (arrowClasses[index] === 'down') {
                                arrow.style.bottom = `-${arrowOffset}px`;
                            } else if (arrowClasses[index] === 'left') {
                                arrow.style.left = `-${arrowOffset}px`;
                            } else if (arrowClasses[index] === 'right') {
                                arrow.style.right = `-${arrowOffset}px`;
                            }

                            // Horizontal/Vertical centering remains from CSS
                            if (arrowClasses[index] === 'up' || arrowClasses[index] === 'down') {
                                arrow.style.left = '50%';
                                arrow.style.transform = 'translateX(-50%)';
                            } else { // left, right
                                arrow.style.top = '50%';
                                arrow.style.transform = 'translateY(-50%)';
                            }

                            arrow.addEventListener('click', (event) => {
                                event.stopPropagation(); 
                                moveStar(arrowClasses[index]);
                            });
                            cell.appendChild(arrow);
                        });
                    }
                }

                if (currentMode === 'setup' || currentMode === 'edit') {
                    if (r === cursorY && c === cursorX) {
                        cell.classList.add('edit-selection-border'); 
                    }
                } else if (currentMode === 'live' || currentMode === 'play') {
                    if (r === starY && c === starX) {
                        cell.classList.add('edit-selection-border'); 
                    }
                }

                targetGrid.appendChild(cell);
            }
        }
    }

    // --- Movement Logic (Star & Cursor) ---
    function moveStar(direction) {
        let newStarX = starX;
        let newStarY = starY;

        switch (direction) {
            case 'up': newStarY = Math.max(0, starY - 1); break;
            case 'down': newStarY = Math.min(GRID_HEIGHT - 1, starY + 1); break;
            case 'left': newStarX = Math.max(0, starX - 1); break;
            case 'right': newStarX = Math.min(GRID_WIDTH - 1, starX + 1); break;
        }

        const currentTargetGrid = (currentMode === 'setup') ? setupGridContainer : gridContainer;

        if (currentMode === 'play') {
            // Check if the new position is within bounds and not a blocked cell (0)
            if (newStarY >= 0 && newStarY < GRID_HEIGHT && newStarX >= 0 && newStarX < GRID_WIDTH && grid[newStarY][newStarX] !== 0) { 
                // Always mark the previous cell as 'marked' (orange) in Play mode
                grid[starY][starX] = 2; 
                starX = newStarX;
                starY = newStarY;
                renderGrid(currentTargetGrid);
            } else {
                console.log("Cannot move to a blocked/unmoveable cell or out of bounds in Play Mode!");
            }
        }
        else if (currentMode === 'live') { 
            // In Live Mode, the star can move anywhere and always leaves a marked (orange) trail.
            // Check if the new position is within bounds.
            if (newStarY >= 0 && newStarY < GRID_HEIGHT && newStarX >= 0 && newStarX < GRID_WIDTH) {
                grid[starY][starX] = 2; // Always mark the previous cell as 'marked' (orange)
                starX = newStarX;
                starY = newStarY;
                renderGrid(currentTargetGrid);
            } else {
                console.log("Cannot move out of bounds in Live Mode!");
            }
        }
        else if (currentMode === 'setup') {
            // In Setup Mode, the star (which represents the initial spawn point) moves freely
            starX = newStarX;
            starY = newStarY;
            cursorX = newStarX; // Cursor also follows star in setup
            cursorY = newStarY;
            renderGrid(currentTargetGrid);
        }
    }

    function moveCursor(direction) {
        let newCursorX = cursorX;
        let newCursorY = cursorY;

        switch (direction) {
            case 'up': newCursorY = Math.max(0, cursorY - 1); break;
            case 'down': newCursorY = Math.min(GRID_HEIGHT - 1, cursorY + 1); break;
            case 'left': newCursorX = Math.max(0, cursorX - 1); break;
            case 'right': newCursorX = Math.min(GRID_WIDTH - 1, cursorX + 1); break;
        }
        
        cursorX = newCursorX;
        cursorY = newCursorY;

        renderGrid(currentMode === 'setup' ? setupGridContainer : gridContainer);
    }

    // --- Event Listeners ---
    setupSetGridSizeBtn.addEventListener('click', () => setGridSize(setupGridWidthInput.value, setupGridHeightInput.value, setupGridContainer));
    setupGridWidthInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            setGridSize(setupGridWidthInput.value, setupGridHeightInput.value, setupGridContainer);
        }
    });
    setupGridHeightInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            setGridSize(setupGridWidthInput.value, setupGridHeightInput.value, setupGridContainer);
        }
    });
    setupFitToScreenBtn.addEventListener('click', () => fitGridToScreen(setupGridContainer, true));
    startGameBtn.addEventListener('click', () => {
        showScreen('game-screen');
        setMode('play'); 
    });

    playModeBtn.addEventListener('click', () => setMode('play'));
    editModeBtn.addEventListener('click', () => setMode('edit'));
    liveModeBtn.addEventListener('click', () => setMode('live'));

    setGridSizeBtn.addEventListener('click', () => setGridSize(gridWidthInput.value, gridHeightInput.value, gridContainer));
    gridWidthInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            setGridSize(gridWidthInput.value, gridHeightInput.value, gridContainer);
        }
    });
    gridHeightInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            setGridSize(gridWidthInput.value, gridHeightInput.value, gridContainer);
        }
    });
    fitToScreenBtn.addEventListener('click', () => fitGridToScreen(gridContainer, true));

    darkModeToggle.addEventListener('click', toggleDarkMode); // Lắng nghe sự kiện từ nút màn hình setup
    
    if (darkModeToggleGame) { // Đảm bảo nút tồn tại trước khi thêm listener
        darkModeToggleGame.addEventListener('click', toggleDarkMode); 
    }

    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();

        if (event.target.tagName === 'INPUT') {
            return;
        }

        if (currentMode !== 'setup') {
            if (event.key === '1') { setMode('play'); return; }
            if (event.key === '2') { setMode('edit'); return; }
            if (event.key === '3') { setMode('live'); return; }
        }

        const currentTargetGrid = (currentMode === 'setup') ? setupGridContainer : gridContainer;

        if (currentMode === 'play' || currentMode === 'live' || currentMode === 'setup') {
            switch (key) {
                case 'w': case 'arrowup': moveStar('up'); break;
                case 's': case 'arrowdown': moveStar('down'); break;
                case 'a': case 'arrowleft': moveStar('left'); break;
                case 'd': case 'arrowright': moveStar('right'); break;
            }
        } else if (currentMode === 'edit') {
            switch (key) {
                case 'w': case 'arrowup': moveCursor('up'); break;
                case 's': case 'arrowdown': moveCursor('down'); break;
                case 'a': case 'arrowleft': moveCursor('left'); break;
                case 'd': case 'arrowright': moveCursor('right'); break;
            }
        }

        if (key === ' ') {
            event.preventDefault(); 
            
            let targetCellX, targetCellY;

            if (currentMode === 'edit' || currentMode === 'setup') {
                targetCellX = cursorX;
                targetCellY = cursorY;
            } else { 
                targetCellX = starX;
                targetCellY = starY;
            }

            if (targetCellY >= 0 && targetCellY < GRID_HEIGHT && targetCellX >= 0 && targetCellX < GRID_WIDTH) {
                if (currentMode === 'setup' || (currentMode !== 'setup' && grid[targetCellY][targetCellX] !== 0)) {
                    grid[targetCellY][targetCellX] = (grid[targetCellY][targetCellX] + 1) % 3;
                }
            }
           
            renderGrid(currentTargetGrid);
        }
    });

    window.addEventListener('resize', () => {
        if (currentMode === 'setup') {
            fitGridToScreen(setupGridContainer, false); 
        } else {
            fitGridToScreen(gridContainer, false); 
        }
    });

    // Initial setup when page loads
    applySavedDarkModePreference(); // Apply dark mode preference on load
    showScreen('setup-screen'); 
});