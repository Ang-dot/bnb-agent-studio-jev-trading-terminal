# Cortical model attribution

`cortex.bin` is adapted from **Brain for Blender**, by **Anderson Winkler**.

- Original work and provenance: https://brainder.org/research/brain-for-blender/
- Source: https://s3.us-east-2.amazonaws.com/brainder/software/brain4blender/smallfiles/pial_Full_obj.tar.bz2
- License: **Creative Commons Attribution-ShareAlike 3.0 Unported**, https://creativecommons.org/licenses/by-sa/3.0/

The adapted mesh is provided under the same CC BY-SA 3.0 license. Changes: vertex clustering, centering, scaling, coordinate conversion, triangle-winding correction, 16-bit coordinate quantization, and compact binary serialization. Both original cortical hemispheres are preserved. `build-cortex.mjs` reproduces the conversion from the extracted public source files. The source has no material or colors; the application supplies them.

The neural particles, memory locations and connections are conceptual application graphics. They do not describe neuroanatomical functions and are not a Living Brain vendor renderer or evidence of a working provider integration. The mesh credit does not imply endorsement.

Three.js is separately MIT licensed: https://github.com/mrdoob/three.js/blob/dev/LICENSE
