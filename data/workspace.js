window.BUNDLED_WORKSPACE = {
  "currentPosition": "Mount",
  "currentChartType": "Attacks",
  "mode": "builder",
  "theme": "light",
  "charts": {
    "Mount::Attacks": {
      "nodes": [
        {
          "id": "n1",
          "label": "Low Mount Control",
          "type": "position",
          "notes": "Start heavy with chest pressure and knees pinched.",
          "x": 40,
          "y": 190
        },
        {
          "id": "n2",
          "label": "Cross Collar Feed",
          "type": "attack",
          "notes": "Slide deep first grip and hide elbow.",
          "x": 340,
          "y": 80
        },
        {
          "id": "n3",
          "label": "High Mount Climb",
          "type": "attack",
          "notes": "Walk knees high when they defend neck.",
          "x": 340,
          "y": 190
        },
        {
          "id": "n4",
          "label": "Opponent Frames",
          "type": "reaction",
          "notes": "Elbows come inside to create distance.",
          "x": 340,
          "y": 300
        },
        {
          "id": "n5",
          "label": "Armbar",
          "type": "finish",
          "notes": "Trap near arm and turn angle.",
          "x": 650,
          "y": 140
        },
        {
          "id": "n6",
          "label": "Mounted Triangle",
          "type": "finish",
          "notes": "Switch if armbar defense stacks.",
          "x": 650,
          "y": 250
        }
      ],
      "edges": [
        { "id": "e1", "from": "n1", "to": "n2", "curved": false, "fromAnchor": 2, "toAnchor": 6 },
        { "id": "e2", "from": "n1", "to": "n3", "curved": false, "fromAnchor": 2, "toAnchor": 6 },
        { "id": "e3", "from": "n1", "to": "n4", "curved": false, "fromAnchor": 2, "toAnchor": 6 },
        { "id": "e4", "from": "n2", "to": "n5", "curved": false, "fromAnchor": 2, "toAnchor": 6 },
        { "id": "e5", "from": "n3", "to": "n5", "curved": false, "fromAnchor": 2, "toAnchor": 6 },
        { "id": "e6", "from": "n4", "to": "n6", "curved": false, "fromAnchor": 2, "toAnchor": 6 }
      ],
      "references": []
    },
    "Mount::Escapes": {
      "nodes": [
        {
          "id": "m1",
          "label": "Bottom Mount Survival",
          "type": "position",
          "notes": "Frame and protect neck while controlling distance.",
          "x": 40,
          "y": 190
        },
        {
          "id": "m2",
          "label": "Opponent Posts Hands",
          "type": "reaction",
          "notes": "Weight shifts forward and hands open.",
          "x": 340,
          "y": 90
        },
        {
          "id": "m3",
          "label": "Opponent Sits Heavy",
          "type": "reaction",
          "notes": "Hips low and head centered.",
          "x": 340,
          "y": 250
        },
        {
          "id": "m4",
          "label": "Trap and Bridge",
          "type": "attack",
          "notes": "Trap arm + foot, bridge over shoulder.",
          "x": 650,
          "y": 90
        },
        {
          "id": "m5",
          "label": "Elbow Knee Escape",
          "type": "attack",
          "notes": "Shrimp and recover half guard.",
          "x": 650,
          "y": 250
        },
        {
          "id": "m6",
          "label": "Recover Guard",
          "type": "finish",
          "notes": "Close guard or establish knee shield.",
          "x": 940,
          "y": 170
        }
      ],
      "edges": [
        { "id": "me1", "from": "m1", "to": "m2", "curved": false, "fromAnchor": 2, "toAnchor": 6 },
        { "id": "me2", "from": "m1", "to": "m3", "curved": false, "fromAnchor": 2, "toAnchor": 6 },
        { "id": "me3", "from": "m2", "to": "m4", "curved": false, "fromAnchor": 2, "toAnchor": 6 },
        { "id": "me4", "from": "m3", "to": "m5", "curved": false, "fromAnchor": 2, "toAnchor": 6 },
        { "id": "me5", "from": "m4", "to": "m6", "curved": false, "fromAnchor": 2, "toAnchor": 6 },
        { "id": "me6", "from": "m5", "to": "m6", "curved": false, "fromAnchor": 2, "toAnchor": 6 }
      ],
      "references": []
    }
  }
}
;
