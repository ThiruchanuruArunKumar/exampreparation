// Authentic TS Intermediate Public Examination (TSBIE) 1st & 2nd Year Question Bank Seed Data

export type SeedSubject = {
  name: string;
  year: "1st_year" | "2nd_year";
  chapters: {
    chapterName: string;
    chapterOrder: number;
    questions: {
      questionType: "very_short_answer" | "short_answer" | "long_answer";
      questionText: string;
      marks: number;
      source: "previous_year" | "textbook" | "admin_added";
      sourceYear?: string;
      verified: boolean;
    }[];
  }[];
};

export const SEED_SUBJECTS: SeedSubject[] = [
  // ==========================================
  // TS INTERMEDIATE 1ST YEAR (JUNIOR INTER)
  // ==========================================
  {
    name: "Mathematics 1A",
    year: "1st_year",
    chapters: [
      {
        chapterName: "Functions",
        chapterOrder: 1,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "If $f(x) = 2x - 1$ and $g(x) = \\frac{x + 1}{2}$ for all $x \\in \\mathbb{R}$, find $(g \\circ f)(x)$.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "very_short_answer",
            questionText: "Find the domain of the real valued function $f(x) = \\sqrt{x^2 - 25}$.",
            marks: 2,
            source: "textbook",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "If $f: \\mathbb{R} \\setminus \\{0\\} \\to \\mathbb{R}$ is defined by $f(x) = x + \\frac{1}{x}$, then prove that $[f(x)]^2 = f(x^2) + f(1)$.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Mathematical Induction",
        chapterOrder: 2,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Use Mathematical Induction to prove that $1^2 + 2^2 + 3^2 + \\dots + n^2 = \\frac{n(n+1)(2n+1)}{6}$ for all $n \\in \\mathbb{N}$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "By Mathematical Induction, prove that $2 + 3 \\cdot 2 + 4 \\cdot 2^2 + \\dots + (n+1)2^{n-1} = n \\cdot 2^n$ for all $n \\in \\mathbb{N}$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2020",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Matrices",
        chapterOrder: 3,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "If $A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$, find $A^2 - 5A - 2I$.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "If $A = \\begin{pmatrix} 1 & -2 & 1 \\\\ 0 & 1 & -1 \\\\ 3 & -1 & 1 \\end{pmatrix}$, find $A^{-1}$.",
            marks: 4,
            source: "textbook",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Solve the following system of linear equations by Gauss-Jordan Method:\n$$x + y + z = 6, \\quad x - y + z = 2, \\quad 2x + y - z = 1$$",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Solve the following system of linear equations using Matrix Inversion Method:\n$$2x - y + 3z = 9, \\quad x + y + z = 6, \\quad x - y + z = 2$$",
            marks: 8,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Addition of Vectors",
        chapterOrder: 4,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "Find the unit vector in the direction of vector $\\vec{a} = 2\\hat{i} + 3\\hat{j} + \\hat{k}$.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "If the position vectors of points $A, B, C$ are $-2\\hat{i} + 3\\hat{j} + 5\\hat{k}$, $\\hat{i} + 2\\hat{j} + 3\\hat{k}$, and $7\\hat{i} - \\hat{k}$ respectively, show that $A, B, C$ are collinear.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2021",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Product of Vectors",
        chapterOrder: 5,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "Find the angle between the vectors $\\vec{a} = \\hat{i} + 2\\hat{j} - \\hat{k}$ and $\\vec{b} = -\\hat{i} + \\hat{j} - 2\\hat{k}$.",
            marks: 2,
            source: "textbook",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Find the shortest distance between the skew lines $\\vec{r} = (6\\hat{i} + 2\\hat{j} + 2\\hat{k}) + t(\\hat{i} - 2\\hat{j} + 2\\hat{k})$ and $\\vec{r} = (-4\\hat{i} - \\hat{k}) + s(3\\hat{i} - 2\\hat{j} - 2\\hat{k})$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Trigonometric Ratios & Transformations",
        chapterOrder: 6,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "Find the value of $\\sin^2 82\\frac{1}{2}^\\circ - \\sin^2 22\\frac{1}{2}^\\circ$.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Prove that $\\cos 20^\\circ \\cos 40^\\circ \\cos 60^\\circ \\cos 80^\\circ = \\frac{1}{16}$.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "If $A, B, C$ are angles of a triangle, prove that:\n$$\\cos A + \\cos B + \\cos C = 1 + 4 \\sin\\frac{A}{2} \\sin\\frac{B}{2} \\sin\\frac{C}{2}$$",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Properties of Triangles",
        chapterOrder: 7,
        questions: [
          {
            questionType: "short_answer",
            questionText: "In $\\Delta ABC$, prove that $a = b \\cos C + c \\cos B$ (Projection Rule).",
            marks: 4,
            source: "textbook",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Show that $r_1 + r_2 + r_3 - r = 4R$ in any triangle $ABC$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  {
    name: "Mathematics 1B",
    year: "1st_year",
    chapters: [
      {
        chapterName: "Locus & Transformation of Axes",
        chapterOrder: 1,
        questions: [
          {
            questionType: "short_answer",
            questionText: "Find the equation of locus of a point $P$, if the distance of $P$ from $A(2, 3)$ is twice the distance of $P$ from $B(1, 2)$.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "When the axes are rotated through an angle $45^\\circ$, find the transformed equation of $3x^2 + 10xy + 3y^2 = 9$.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "The Straight Line",
        chapterOrder: 2,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "Find the length of the perpendicular from the origin to the line $3x - 4y + 10 = 0$.",
            marks: 2,
            source: "textbook",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Find the equation of the line passing through $(2, 3)$ and making intercepts on the axes whose sum is $12$.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Find the orthocenter of the triangle formed by the vertices $A(-2, -1)$, $B(6, -1)$, and $C(2, 5)$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Find the circumcenter of the triangle formed by the points $(1, 3)$, $(-3, 5)$, and $(5, -1)$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Pair of Straight Lines",
        chapterOrder: 3,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Show that the lines represented by $ax^2 + 2hxy + by^2 = 0$ form an equilateral triangle with the line $lx + my + n = 0$ if $(3h^2 - ab)(l^2 + m^2) = (al - 2hlm + bm)^2$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Find the condition for the lines joining the origin to the points of intersection of the circle $x^2 + y^2 = a^2$ and line $lx + my = 1$ to be perpendicular.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2021",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Limits and Continuity",
        chapterOrder: 4,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "Evaluate $\\lim_{x \\to 0} \\frac{e^{3x} - 1}{x}$.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Check the continuity of $f(x) = \\begin{cases} \\frac{\\sin 2x}{x} & \\text{if } x \\neq 0 \\\\ 2 & \\text{if } x = 0 \\end{cases}$ at $x = 0$.",
            marks: 4,
            source: "textbook",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Differentiation & Applications",
        chapterOrder: 5,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "If $y = \\tan^{-1}(\\sqrt{x})$, find $\\frac{dy}{dx}$.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Find the derivative of $\\sin x$ from the first principle.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Find the equations of tangent and normal to the curve $y = x^3 - 3x + 2$ at the point where $x = 2$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  {
    name: "Physics (1st Year)",
    year: "1st_year",
    chapters: [
      {
        chapterName: "Physical World & Measurements",
        chapterOrder: 1,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "What are the fundamental forces in nature?",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "very_short_answer",
            questionText: "Distinguish between accuracy and precision in measurement.",
            marks: 2,
            source: "textbook",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Motion in a Straight Line",
        chapterOrder: 2,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "A particle is thrown vertically upwards. What is its velocity and acceleration at the highest point?",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Derive the kinematic equation $v^2 - u^2 = 2as$ using calculus or graphical method.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Motion in a Plane",
        chapterOrder: 3,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "Define dot product of two vectors and give an example.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Show that the trajectory of an oblique projectile is a parabola.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Laws of Motion",
        chapterOrder: 4,
        questions: [
          {
            questionType: "short_answer",
            questionText: "State Newton's second law of motion and derive the formula $F = ma$.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Mention methods to reduce friction between contacting surfaces.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2021",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Work, Energy & Power",
        chapterOrder: 5,
        questions: [
          {
            questionType: "long_answer",
            questionText: "State and prove the Law of Conservation of Mechanical Energy in the case of a freely falling body.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "What are elastic and inelastic collisions? Derive an expression for final velocities of two bodies undergoing 1D elastic collision.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "System of Particles & Oscillations",
        chapterOrder: 6,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Define Simple Harmonic Motion (SHM). Show that the motion of a simple pendulum is SHM and derive the expression for its time period $T = 2\\pi \\sqrt{\\frac{L}{g}}$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Thermodynamics",
        chapterOrder: 7,
        questions: [
          {
            questionType: "long_answer",
            questionText: "State Second Law of Thermodynamics. Explain the working of Carnot Heat Engine with a neat indicator diagram and write the expression for its efficiency.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  {
    name: "Chemistry (1st Year)",
    year: "1st_year",
    chapters: [
      {
        chapterName: "Atomic Structure",
        chapterOrder: 1,
        questions: [
          {
            questionType: "long_answer",
            questionText: "What are the postulates of Bohr's atomic model? Mention its limitations and derive an expression for the radius of $n$-th orbit of Hydrogen atom.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "What are quantum numbers? Explain the significance of Principal ($n$), Azimuthal ($l$), Magnetic ($m_l$), and Spin ($m_s$) quantum numbers.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Classification of Elements & Periodicity",
        chapterOrder: 2,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Define Ionization Enthalpy ($IE_1$ and $IE_2$). Why is $IE_2 > IE_1$? Explain factors affecting Ionization Potential.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Chemical Bonding & Molecular Structure",
        chapterOrder: 3,
        questions: [
          {
            questionType: "short_answer",
            questionText: "Explain Hybridization. Discuss $sp^3d$ hybridization with $\\ce{PCl5}$ molecule as example.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Explain Molecular Orbital Theory (MOT). Draw MO energy level diagram for $\\ce{N2}$ and $\\ce{O2}$ molecules and calculate their bond order.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2021",
            verified: true,
          },
        ],
      },
      {
        chapterName: "States of Matter & Stoichiometry",
        chapterOrder: 4,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "State Graham's Law of Diffusion.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Balance the redox reaction in acidic medium using ion-electron method:\n$$\\ce{MnO4- + Fe^2+ -> Mn^2+ + Fe^3+}$$",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Organic Chemistry - Principles & Hydrocarbons",
        chapterOrder: 5,
        questions: [
          {
            questionType: "short_answer",
            questionText: "Explain Wurtz reaction and Friedel-Crafts alkylation with chemical equations.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "How is Ethylene (Ethene) prepared in laboratory? Write its reactions with (a) Ozone, (b) Cold dilute alkaline $\\ce{KMnO4}$ (Baeyer's reagent).",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  {
    name: "Botany (1st Year)",
    year: "1st_year",
    chapters: [
      {
        chapterName: "Living World & Classification",
        chapterOrder: 1,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "What is binomial nomenclature? Who introduced it?",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Write a short note on Chrysophytes and Dinoflagellates.",
            marks: 4,
            source: "textbook",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Reproduction in Plants",
        chapterOrder: 2,
        questions: [
          {
            questionType: "long_answer",
            questionText: "With the help of a neat labeled diagram, describe the structure of a mature 7-celled 8-nucleate embryo sac (female gametophyte) of angiosperms.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Histology & Anatomy of Flowering Plants",
        chapterOrder: 3,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Describe the internal structure of a Dicot Stem with a neat labeled diagram. Differentiate it from Monocot stem.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  {
    name: "Zoology (1st Year)",
    year: "1st_year",
    chapters: [
      {
        chapterName: "Structural Organization in Animals",
        chapterOrder: 1,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "What is Haversian system? Where is it found?",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Describe the structure of a cardiac muscle tissue with a diagram.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Cockroach Anatomy & Biology",
        chapterOrder: 2,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Describe the Digestive System of Cockroach (Periplaneta americana) with a neat labeled diagram.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Biology & Human Welfare",
        chapterOrder: 3,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Describe the life cycle of Plasmodium vivax in Man (Asexual cycle / Schizogony) with suitable diagrams.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  // ==========================================
  // TS INTERMEDIATE 2ND YEAR (SENIOR INTER)
  // ==========================================
  {
    name: "Mathematics 2A",
    year: "2nd_year",
    chapters: [
      {
        chapterName: "Complex Numbers & De Moivre's Theorem",
        chapterOrder: 1,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "If $z = 2 - 3i$, find $z^{-1}$ in the form $a + ib$.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "If $n$ is an integer, prove that $(1 + \\cos \\theta + i \\sin \\theta)^n + (1 + \\cos \\theta - i \\sin \\theta)^n = 2^{n+1} \\cos^n\\left(\\frac{\\theta}{2}\\right) \\cos\\left(\\frac{n\\theta}{2}\\right)$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Theory of Equations",
        chapterOrder: 2,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Solve the equation $x^4 - 10x^3 + 26x^2 - 10x + 1 = 0$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Permutations & Combinations",
        chapterOrder: 3,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "If $^{n}P_4 = 1680$, find $n$.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Find the number of ways of seating 5 boys and 5 girls around a circular table such that no two girls sit together.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Binomial Theorem",
        chapterOrder: 4,
        questions: [
          {
            questionType: "long_answer",
            questionText: "If the coefficients of $r$-th, $(r+1)$-th, and $(r+2)$-th terms in the expansion of $(1+x)^n$ are in A.P., show that $n^2 - n(4r+1) + 4r^2 - 2 = 0$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Probability & Random Variables",
        chapterOrder: 5,
        questions: [
          {
            questionType: "short_answer",
            questionText: "State and prove Addition Theorem on Probability.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "State and prove Baye's Theorem.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  {
    name: "Mathematics 2B",
    year: "2nd_year",
    chapters: [
      {
        chapterName: "Circles",
        chapterOrder: 1,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "Find the center and radius of the circle $x^2 + y^2 - 4x + 6y - 12 = 0$.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Find the equation of the circle passing through $(0, 0)$, $(a, 0)$, and $(0, b)$.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Find the equation of the circle passing through the three points $(1, 1)$, $(2, -1)$, and $(3, 2)$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "System of Circles & Conics",
        chapterOrder: 2,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Derive the standard equation of Parabola $y^2 = 4ax$ with a neat diagram.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Find the eccentricity, foci, and directrices of the ellipse $9x^2 + 16y^2 = 144$.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Integration",
        chapterOrder: 3,
        questions: [
          {
            questionType: "very_short_answer",
            questionText: "Evaluate $\\int \\frac{1}{\\sqrt{1 - 4x^2}} \\, dx$.",
            marks: 2,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Evaluate $\\int \\frac{2x + 5}{\\sqrt{x^2 - 2x + 10}} \\, dx$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Evaluate reduction formula for $\\int \\sin^n x \\, dx$ and hence find $\\int \\sin^4 x \\, dx$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Definite Integrals & Differential Equations",
        chapterOrder: 4,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Evaluate $\\int_0^{\\pi/2} \\frac{\\sqrt{\\sin x}}{\\sqrt{\\sin x} + \\sqrt{\\cos x}} \\, dx$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Solve the linear differential equation $\\frac{dy}{dx} + y \\tan x = \\sec x$.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  {
    name: "Physics (2nd Year)",
    year: "2nd_year",
    chapters: [
      {
        chapterName: "Waves",
        chapterOrder: 1,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Explain the formation of stationary waves in stretched strings. Derive the frequency of fundamental note and harmonics.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Explain Doppler effect in sound. Derive expression for apparent frequency when observer moves towards a stationary source.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Current Electricity",
        chapterOrder: 2,
        questions: [
          {
            questionType: "long_answer",
            questionText: "State Kirchhoff's laws. Apply them to derive the balancing condition of Wheatstone's bridge ($P/Q = R/S$).",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "State and explain Ohm's Law. Define electrical resistivity.",
            marks: 4,
            source: "textbook",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Nuclei & Semiconductor Electronics",
        chapterOrder: 3,
        questions: [
          {
            questionType: "long_answer",
            questionText: "What is radioactivity? State radioactive decay law. Derive $N(t) = N_0 e^{-\\lambda t}$ and half-life formula $T_{1/2} = \\frac{0.693}{\\lambda}$.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Describe the working of a full-wave rectifier with a neat circuit diagram.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  {
    name: "Chemistry (2nd Year)",
    year: "2nd_year",
    chapters: [
      {
        chapterName: "Electrochemistry & Kinetics",
        chapterOrder: 1,
        questions: [
          {
            questionType: "short_answer",
            questionText: "State Kohlrausch's law of independent migration of ions and write its applications.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "What is order and molecularity of a reaction? Derive the rate constant equation for a first-order chemical reaction.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
      {
        chapterName: "p-Block & Coordination Chemistry",
        chapterOrder: 2,
        questions: [
          {
            questionType: "long_answer",
            questionText: "How is Ammonia prepared industrially by Haber's process? Mention optimum conditions and write reactions with $\\ce{Cu^2+}$ and $\\ce{Ag+}$ ions.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "short_answer",
            questionText: "Explain Werner's theory of coordination compounds with examples.",
            marks: 4,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Organic Chemistry Containing Oxygen & Nitrogen",
        chapterOrder: 3,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Explain named organic reactions with equations: (a) Reimer-Tiemann reaction, (b) Kolbe's reaction, (c) Cannizzaro reaction, (d) Aldol condensation.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  {
    name: "Botany (2nd Year)",
    year: "2nd_year",
    chapters: [
      {
        chapterName: "Plant Physiology & Molecular Biology",
        chapterOrder: 1,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Explain non-cyclic photophosphorylation (Z-scheme) in plants with a schematic diagram.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Give an account of Glycolysis (EMP pathway) with flowchart.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Biotechnology & Applications",
        chapterOrder: 2,
        questions: [
          {
            questionType: "long_answer",
            questionText: "What is Recombinant DNA technology? Describe the tools used in rDNA technology (Restriction Enzymes, Vectors, Competent host).",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },

  {
    name: "Zoology (2nd Year)",
    year: "2nd_year",
    chapters: [
      {
        chapterName: "Human Anatomy & Reproduction",
        chapterOrder: 1,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Describe the Male Reproductive System of human beings with a neat labeled diagram.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
          {
            questionType: "long_answer",
            questionText: "Describe the structure of Human Heart with the help of a neat labeled diagram and explain cardiac cycle.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2022",
            verified: true,
          },
        ],
      },
      {
        chapterName: "Genetics & Human Health",
        chapterOrder: 2,
        questions: [
          {
            questionType: "long_answer",
            questionText: "Explain sex determination in human beings and describe sex-linked inheritance with Hemophilia as example.",
            marks: 8,
            source: "previous_year",
            sourceYear: "2023",
            verified: true,
          },
        ],
      },
    ],
  },
];
