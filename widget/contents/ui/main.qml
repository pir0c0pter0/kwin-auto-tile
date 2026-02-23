import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.components as PlasmaComponents3
import org.kde.plasma.plasma5support as Plasma5Support
import org.kde.kirigami as Kirigami

PlasmoidItem {
    id: root

    property int maxVisible: 4
    property bool tileEnabled: true

    preferredRepresentation: compactRepresentation
    toolTipMainText: "Auto Tile"
    toolTipSubText: tileEnabled
        ? maxVisible + (maxVisible === 1 ? " column" : " columns")
        : "Disabled"

    onExpandedChanged: {
        if (expanded) readState()
    }

    Component.onCompleted: readState()

    // ─── Command executor ───

    Plasma5Support.DataSource {
        id: executable
        engine: "executable"
        connectedSources: []

        onNewData: (sourceName, data) => {
            let stdout = (data["stdout"] || "").trim()

            if (sourceName.startsWith("kreadconfig6")) {
                if (sourceName.includes("maxVisible")) {
                    let n = parseInt(stdout)
                    if (n >= 1 && n <= 8) root.maxVisible = n
                } else if (sourceName.includes("kwin-auto-tileEnabled")) {
                    root.tileEnabled = (stdout === "true")
                }
            }

            disconnectSource(sourceName)
        }
    }

    function readState() {
        executable.connectSource(
            "kreadconfig6 --file kwinrc --group Script-kwin-auto-tile --key maxVisible --default 4"
        )
        executable.connectSource(
            "kreadconfig6 --file kwinrc --group Plugins --key kwin-auto-tileEnabled --default true"
        )
    }

    function setColumns(n) {
        let safe = Math.max(1, Math.min(8, Math.trunc(n)))
        root.maxVisible = safe
        executable.connectSource(
            "kwriteconfig6 --file kwinrc --group Script-kwin-auto-tile --key maxVisible " + safe +
            " && qdbus6 org.kde.KWin /KWin reconfigure"
        )
    }

    function toggleEnabled() {
        let newState = !root.tileEnabled
        root.tileEnabled = newState
        executable.connectSource(
            "kwriteconfig6 --file kwinrc --group Plugins --key kwin-auto-tileEnabled " +
            (newState ? "true" : "false") +
            " && qdbus6 org.kde.KWin /KWin reconfigure"
        )
    }

    function retile() {
        executable.connectSource("qdbus6 org.kde.KWin /KWin reconfigure #" + Date.now())
    }

    // ─── Compact Representation (panel icon) ───

    compactRepresentation: Item {
        id: compactRoot

        Layout.preferredWidth: columnBars.implicitWidth + Kirigami.Units.smallSpacing * 2
        Layout.preferredHeight: Kirigami.Units.iconSizes.small

        Row {
            id: columnBars
            anchors.centerIn: parent
            spacing: 2
            opacity: root.tileEnabled ? 1.0 : 0.35

            Repeater {
                model: root.maxVisible

                Rectangle {
                    width: 4
                    height: Math.max(compactRoot.height * 0.5, 6)
                    radius: 1
                    color: Kirigami.Theme.textColor
                }
            }
        }

        Rectangle {
            anchors.bottom: parent.bottom
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.bottomMargin: 1
            width: 4
            height: 4
            radius: 2
            visible: root.tileEnabled
            color: Kirigami.Theme.positiveTextColor
        }
    }

    // ─── Full Representation (popup) ───

    fullRepresentation: Item {
        Layout.preferredWidth: Kirigami.Units.gridUnit * 16
        Layout.preferredHeight: Kirigami.Units.gridUnit * 15
        Layout.minimumWidth: Kirigami.Units.gridUnit * 14

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: Kirigami.Units.largeSpacing
            spacing: Kirigami.Units.largeSpacing

            // ─── Header ───
            RowLayout {
                Layout.fillWidth: true
                spacing: Kirigami.Units.smallSpacing

                Kirigami.Icon {
                    source: "view-split-left-right"
                    Layout.preferredWidth: Kirigami.Units.iconSizes.small
                    Layout.preferredHeight: Kirigami.Units.iconSizes.small
                }

                Kirigami.Heading {
                    text: "Column Layout"
                    level: 4
                    Layout.fillWidth: true
                }

                PlasmaComponents3.Switch {
                    checked: root.tileEnabled
                    onToggled: root.toggleEnabled()
                }
            }

            // ─── Column Selector Grid ───
            GridLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                columns: 2
                rowSpacing: Kirigami.Units.smallSpacing * 2
                columnSpacing: Kirigami.Units.smallSpacing * 2
                opacity: root.tileEnabled ? 1.0 : 0.4

                Repeater {
                    model: [1, 2, 3, 4]

                    delegate: Rectangle {
                        id: option

                        required property int modelData
                        readonly property int colCount: modelData
                        readonly property bool isSelected: colCount === root.maxVisible

                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        Layout.minimumHeight: Kirigami.Units.gridUnit * 3

                        radius: Kirigami.Units.cornerRadius ?? 3
                        color: isSelected
                            ? Qt.alpha(Kirigami.Theme.highlightColor, 0.15)
                            : Kirigami.Theme.backgroundColor
                        border.color: isSelected
                            ? Kirigami.Theme.highlightColor
                            : (optionMouse.containsMouse
                                ? Kirigami.Theme.disabledTextColor
                                : Qt.alpha(Kirigami.Theme.textColor, 0.15))
                        border.width: isSelected ? 2 : 1

                        Behavior on color { ColorAnimation { duration: 150 } }
                        Behavior on border.color { ColorAnimation { duration: 150 } }

                        ColumnLayout {
                            anchors.fill: parent
                            anchors.margins: Kirigami.Units.smallSpacing
                            spacing: Kirigami.Units.smallSpacing

                            // Visual column representation
                            Item {
                                Layout.fillWidth: true
                                Layout.fillHeight: true

                                Row {
                                    anchors.centerIn: parent
                                    spacing: 3

                                    Repeater {
                                        model: option.colCount

                                        Rectangle {
                                            width: {
                                                let avail = option.width
                                                    - Kirigami.Units.smallSpacing * 2
                                                    - (option.colCount - 1) * 3
                                                return Math.max(8, avail / option.colCount)
                                            }
                                            height: option.height * 0.4
                                            radius: 3
                                            color: option.isSelected
                                                ? Kirigami.Theme.highlightColor
                                                : (optionMouse.containsMouse
                                                    ? Qt.alpha(Kirigami.Theme.textColor, 0.4)
                                                    : Qt.alpha(Kirigami.Theme.textColor, 0.2))

                                            Behavior on color {
                                                ColorAnimation { duration: 150 }
                                            }
                                        }
                                    }
                                }
                            }

                            // Label
                            PlasmaComponents3.Label {
                                Layout.alignment: Qt.AlignHCenter
                                text: option.colCount === 1
                                    ? "Single"
                                    : option.colCount + " Columns"
                                font.family: Kirigami.Theme.smallFont.family
                                font.pixelSize: Kirigami.Theme.smallFont.pixelSize
                                font.bold: option.isSelected
                                color: option.isSelected
                                    ? Kirigami.Theme.highlightColor
                                    : Kirigami.Theme.textColor
                            }
                        }

                        MouseArea {
                            id: optionMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            enabled: root.tileEnabled
                            onClicked: root.setColumns(option.colCount)
                        }
                    }
                }
            }

            // ─── Status Bar ───
            RowLayout {
                Layout.fillWidth: true
                spacing: Kirigami.Units.smallSpacing

                Rectangle {
                    width: 8
                    height: 8
                    radius: 4
                    color: root.tileEnabled
                        ? Kirigami.Theme.positiveTextColor
                        : Kirigami.Theme.disabledTextColor
                }

                PlasmaComponents3.Label {
                    text: root.tileEnabled
                        ? "Active \u2014 " + root.maxVisible +
                          (root.maxVisible === 1 ? " column" : " columns")
                        : "Disabled"
                    font.family: Kirigami.Theme.smallFont.family
                    font.pixelSize: Kirigami.Theme.smallFont.pixelSize
                    opacity: 0.7
                    Layout.fillWidth: true
                }

                PlasmaComponents3.ToolButton {
                    icon.name: "view-refresh"
                    visible: root.tileEnabled
                    onClicked: root.retile()
                    implicitWidth: Kirigami.Units.iconSizes.small + Kirigami.Units.smallSpacing * 2
                    implicitHeight: implicitWidth
                }
            }
        }
    }
}
