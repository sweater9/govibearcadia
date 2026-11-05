# Aadu Puli Attam

This implementation follows the common Tamil/South Indian 23-intersection form documented by D’Source at IIT Bombay: three tigers begin at the apex and the two closest inner intersections; fifteen goats begin off-board; goats enter one per goat turn and cannot move until all have entered; tigers move one adjacent step or capture one adjacent goat by a straight-line jump; five captures win for the tigers; immobilizing all three tigers wins for the goats.

The board graph is defined in `src/games/aadupuli/rules.ts` as ten uninterrupted drawn lines: four rays from the apex, three six-point crossbars, the four-point base, and two outer side lines. Adjacency is derived from consecutive points. Capture triples are derived from three consecutive points on the same line, preventing visually close but unconnected moves.

Rules vary by family. This version intentionally uses fixed tiger starting positions, goats first, optional captures, one capture per turn, and a five-goat tiger target. It does not use tiger placement, mandatory capture, multi-jump capture, repetition draws, or alternative capture targets.

Research references:

- D’Source, IDC School of Design, IIT Bombay, “Indian Games: Adu Puli Attam” (23 intersections, setup, phases, single capture, five-goat and immobilization goals): https://www.dsource.in/resource/indian-games/board-games/adu-puli-attam
- Indian Heritage Centre, Singapore, printable “Aadu Puli Aatam” guide (3/15 pieces, adjacent line movement, single jump, trapped-tiger goal): https://www.indianheritage.gov.sg/-/media/aadu-puli-aatam---printable.pdf
- Durham University, “Aadu Puli Attam” activity sheet (fixed tiger start, goat placement phase, single captures): https://durham.ac.uk/things-to-do/media/things-to-do/learn/online-resources/primary-school-resources/ancient-games/Aadu-Puli-Attam-Game.pdf
