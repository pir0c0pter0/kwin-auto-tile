// kwin-auto-tile: Manual tiling script for KDE Plasma 6
// Organizes windows into a bounded grid only when explicitly triggered.

// ─── Section 1: Configuration ───

var config = {
    enabled: readConfig("enabled", true),
    maxVisible: readConfig("maxVisible", 4),
    gapSize: readConfig("gapSize", 8),
    respectMinimized: readConfig("respectMinimized", true),
    filterByClass: []
};

function clampInt(value, fallback, min, max) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        return fallback;
    }
    if (parsed < min) {
        return min;
    }
    if (parsed > max) {
        return max;
    }
    return parsed;
}

function parseFilterByClassValue(raw) {
    if (typeof raw !== "string" || raw.length === 0) {
        return [];
    }

    // Support both comma-separated and newline-separated formats
    return raw.split(/[,\n]/)
        .map(function(s) { return s.trim().toLowerCase(); })
        .filter(function(s) { return s.length > 0; });
}

function refreshConfig() {
    config.enabled = !!readConfig("enabled", config.enabled);
    config.maxVisible = clampInt(readConfig("maxVisible", config.maxVisible), 4, 1, 8);
    config.gapSize = clampInt(readConfig("gapSize", config.gapSize), 8, 0, 32);
    config.respectMinimized = !!readConfig("respectMinimized", config.respectMinimized);
    config.filterByClass = parseFilterByClassValue(readConfig("filterByClass", ""));
}

refreshConfig();

// ─── Section 2: State ───

var knownWindowIds = {};       // id -> true (tracks known windows)
var prevLayoutKeys = {};       // "desktopId:outputName" -> layout cache key
var excludedWindowIds = {};    // id -> true (user-excluded via context menu)
var windowInsertOrder = [];    // window ids in insertion order for stable layout

// ─── Section 3: Window Filtering ───

function isTileable(window) {
    if (!window) {
        return false;
    }

    // Guard against accessing properties on destroyed windows
    try {
        var isNormal = window.normalWindow;
    } catch (e) {
        return false;
    }

    if (!isNormal) {
        return false;
    }

    // Reject special window types
    if (window.dialog || window.splash || window.utility ||
        window.dock || window.desktopWindow || window.popupMenu ||
        window.tooltip || window.notification || window.criticalNotification ||
        window.appletPopup || window.onScreenDisplay) {
        return false;
    }

    // Reject minimized windows if configured
    if (config.respectMinimized && window.minimized) {
        return false;
    }

    // Reject fullscreen windows
    if (window.fullScreen) {
        return false;
    }

    // Reject user-excluded windows
    if (excludedWindowIds[window.internalId]) {
        return false;
    }

    // Check class filter
    if (config.filterByClass.length > 0) {
        var windowClass = (window.resourceClass || "").toLowerCase();
        var windowName = (window.resourceName || "").toLowerCase();
        for (var i = 0; i < config.filterByClass.length; i++) {
            var filter = config.filterByClass[i];
            if (windowClass === filter || windowName === filter) {
                return false;
            }
        }
    }

    // Reject windows that cannot be resized
    if (!window.resizeable) {
        return false;
    }

    return true;
}

// ─── Section 4: Window Grouping ───

function getDesktopKey(desktop, output) {
    var desktopId = desktop ? desktop.id : "all";
    var outputName = output ? output.name : "unknown";
    return desktopId + ":" + outputName;
}

function getWindowGroups() {
    var groups = {};
    var allWindows = workspace.windowList();
    var groupKey;

    for (var i = 0; i < allWindows.length; i++) {
        var win = allWindows[i];
        if (!isTileable(win)) {
            continue;
        }

        var output = win.output;
        if (!output) {
            continue;
        }

        if (win.onAllDesktops) {
            var currentDesktop = workspace.currentDesktop;
            groupKey = getDesktopKey(currentDesktop, output);
            if (!groups[groupKey]) {
                groups[groupKey] = { desktop: currentDesktop, output: output, windows: [] };
            }
            groups[groupKey].windows.push(win);
        } else {
            var desktops = win.desktops;
            for (var d = 0; d < desktops.length; d++) {
                var desktop = desktops[d];
                groupKey = getDesktopKey(desktop, output);
                if (!groups[groupKey]) {
                    groups[groupKey] = { desktop: desktop, output: output, windows: [] };
                }
                groups[groupKey].windows.push(win);
            }
        }
    }

    return groups;
}

// ─── Section 5: Redistribution Algorithm ───

function sortByInsertOrder(windows) {
    var orderMap = {};
    for (var i = 0; i < windowInsertOrder.length; i++) {
        orderMap[windowInsertOrder[i]] = i;
    }
    return windows.slice().sort(function(a, b) {
        var idxA = (a.internalId in orderMap) ? orderMap[a.internalId] : 999999;
        var idxB = (b.internalId in orderMap) ? orderMap[b.internalId] : 999999;
        return idxA - idxB;
    });
}

function redistributeGroup(group) {
    var windows = sortByInsertOrder(group.windows);
    var count = windows.length;

    if (count === 0) {
        return;
    }

    var key = getDesktopKey(group.desktop, group.output);

    // Cache includes window IDs so moves/swaps invalidate it
    var windowIds = windows.map(function(w) { return w.internalId; }).join(",");
    var layoutKey = count + ":" + config.maxVisible + ":" + config.gapSize + ":" + windowIds;
    if (prevLayoutKeys[key] === layoutKey) {
        return;
    }
    prevLayoutKeys[key] = layoutKey;

    // Get available area (respects panels, docks, etc.)
    var area = workspace.clientArea(
        KWin.PlacementArea,
        group.output,
        group.desktop
    );

    if (!area || area.width <= 0 || area.height <= 0) {
        return;
    }

    var gap = config.gapSize;
    var maxColumns = Math.max(1, config.maxVisible);
    var rowCount = Math.ceil(count / maxColumns);
    var totalGapsV = gap * (rowCount + 1);
    var availableHeight = area.height - totalGapsV;
    if (availableHeight <= 0) {
        return;
    }

    var rowHeight = Math.floor(availableHeight / rowCount);
    if (rowHeight <= 0) {
        return;
    }

    var handled = 0;
    for (var row = 0; row < rowCount; row++) {
        var remaining = count - handled;
        var columnsInRow = Math.min(maxColumns, remaining);
        var totalGapsH = gap * (columnsInRow + 1);
        var availableWidth = area.width - totalGapsH;
        if (availableWidth <= 0) {
            handled += columnsInRow;
            continue;
        }

        var colWidth = Math.floor(availableWidth / columnsInRow);
        if (colWidth <= 0) {
            handled += columnsInRow;
            continue;
        }

        var y = area.y + gap + (row * (rowHeight + gap));
        for (var col = 0; col < columnsInRow; col++) {
            var win = windows[handled + col];
            var x = area.x + gap + (col * (colWidth + gap));
            win.frameGeometry = {
                x: x,
                y: y,
                width: colWidth,
                height: rowHeight
            };
        }
        handled += columnsInRow;
    }
}

function redistribute() {
    if (!config.enabled) {
        return;
    }

    var groups = getWindowGroups();
    for (var key in groups) {
        if (groups.hasOwnProperty(key)) {
            redistributeGroup(groups[key]);
        }
    }
}

// ─── Section 6: Manual Retile Helpers ───

function invalidateLayoutCache() {
    prevLayoutKeys = {};
}

function forceRedistribute() {
    invalidateLayoutCache();
    redistribute();
}

// ─── Section 7: Event Handlers ───

function onWindowAdded(window) {
    if (!window) {
        return;
    }

    var id = window.internalId;

    // Track insertion order so manual re-tiling remains stable.
    if (windowInsertOrder.indexOf(id) === -1) {
        windowInsertOrder.push(id);
    }

    knownWindowIds[id] = true;
    invalidateLayoutCache();
}

function onWindowRemoved(window) {
    if (!window) {
        return;
    }

    var id = window.internalId;
    delete knownWindowIds[id];
    delete excludedWindowIds[id];

    // Remove from insert order
    var idx = windowInsertOrder.indexOf(id);
    if (idx !== -1) {
        windowInsertOrder.splice(idx, 1);
    }

    invalidateLayoutCache();
}

// ─── Section 8: Keyboard Shortcuts ───

function registerShortcuts() {
    registerShortcut(
        "AutoTile: 1 Column",
        "Auto Tile: Set 1 column",
        "Meta+Ctrl+1",
        function() {
            config.maxVisible = 1;
            forceRedistribute();
        }
    );

    registerShortcut(
        "AutoTile: 2 Columns",
        "Auto Tile: Set 2 columns",
        "Meta+Ctrl+2",
        function() {
            config.maxVisible = 2;
            forceRedistribute();
        }
    );

    registerShortcut(
        "AutoTile: 3 Columns",
        "Auto Tile: Set 3 columns",
        "Meta+Ctrl+3",
        function() {
            config.maxVisible = 3;
            forceRedistribute();
        }
    );

    registerShortcut(
        "AutoTile: 4 Columns",
        "Auto Tile: Set 4 columns",
        "Meta+Ctrl+4",
        function() {
            config.maxVisible = 4;
            forceRedistribute();
        }
    );

    registerShortcut(
        "AutoTile: Re-tile",
        "Auto Tile: Force re-tile all windows",
        "Meta+Ctrl+T",
        function() {
            forceRedistribute();
        }
    );
}

// ─── Section 9: Context Menu ───

function registerContextMenu() {
    registerUserActionsMenu(function(window) {
        var id = window.internalId;
        var isExcluded = !!excludedWindowIds[id];

        return {
            text: isExcluded ? "Include in Auto-Tile" : "Exclude from Auto-Tile",
            triggered: function() {
                if (isExcluded) {
                    delete excludedWindowIds[id];
                } else {
                    excludedWindowIds[id] = true;
                }
                forceRedistribute();
            }
        };
    });
}

// ─── Section 10: Initialization ───

(function init() {
    if (!config.enabled) {
        return;
    }

    registerShortcuts();
    registerContextMenu();

    // Track windows for insertion-order stability, but do not auto-retile.
    workspace.windowAdded.connect(onWindowAdded);
    workspace.windowRemoved.connect(onWindowRemoved);

    // Initialize with existing windows.
    var existingWindows = workspace.windowList();
    for (var i = 0; i < existingWindows.length; i++) {
        var win = existingWindows[i];
        var id = win.internalId;
        knownWindowIds[id] = true;
        if (windowInsertOrder.indexOf(id) === -1) {
            windowInsertOrder.push(id);
        }
    }

    // Keep the explicit "click to tile" behavior available in the widget,
    // which reloads this script and expects an immediate re-tile.
    forceRedistribute();
})();
