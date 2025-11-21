// Import necessary scripts for the worker
try {
    importScripts(
        'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    );
} catch (e) {
    console.error('Error importing scripts into worker:', e);
    self.postMessage({ type: 'error', error: 'Failed to load external libraries.' });
}


// --- HELPER FUNCTIONS (Copied from filter.js) ---
function cleanQuestionText(text) {
    return (text || "").replace(/^(Q\.\d+\)|प्रश्न \d+\))\s*/, '');
}

function parseMarkdownForPptx(markdown) {
    if (!markdown) return [];

    const richTextArray = [];
    const lines = markdown.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?pre>/g, '').split('\n');

    lines.forEach((line, index) => {
        const processedLine = line.replace(/^[-*]\s*/, '• ');
        const parts = processedLine.split(/(\*\*.*?\*\*)/g).filter(Boolean);

        if (parts.length === 0 && line.trim() === '') {
            richTextArray.push({ text: '\n' });
            return;
        }

        parts.forEach(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
                richTextArray.push({
                    text: part.substring(2, part.length - 2),
                    options: { bold: true }
                });
            } else if (part) {
                richTextArray.push({ text: part });
            }
        });

        if (index < lines.length - 1) {
            richTextArray.push({ text: '\n' });
        }
    });
    return richTextArray;
}


// --- MAIN WORKER LOGIC ---
self.onmessage = async (event) => {
    const { type, format, questions, selectedFilters } = event.data;
    if (type === 'generate') {
        try {
            if (format === 'ppt') {
                await generatePowerPoint(questions, selectedFilters);
            } else if (format === 'pdf') {
                await generatePDF(questions, selectedFilters);
            }
        } catch (error) {
            console.error(`Worker error during ${format} generation:`, error);
            self.postMessage({ type: 'error', error: error.message });
        }
    }
};


// --- PPT GENERATION (Adapted for Worker) ---
async function generatePowerPoint(questions, selectedFilters) {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Quiz LM App';
    pptx.company = 'AI-Powered Learning';
    pptx.title = 'Customized Quiz Presentation';

    // ... (Styles and constants remain the same) ...
    const TITLE_SLIDE_BG = 'F5F5F5';
    const QUESTION_SLIDE_BG = 'D6EAF8';
    const ANSWER_SLIDE_BG = 'E2F0D9';
    const TEXT_COLOR = '191919';
    const CORRECT_ANSWER_COLOR = '006400';
    const ENGLISH_FONT = 'Arial';
    const HINDI_FONT = 'Nirmala UI';

    // --- TITLE SLIDE ---
    let titleSlide = pptx.addSlide();
    titleSlide.background = { color: TITLE_SLIDE_BG };
    titleSlide.addText("Quiz LM Presentation ✨", { x: 0.5, y: 0.8, w: '90%', h: 1, fontSize: 44, color: '303f9f', bold: true, align: 'center' });
    titleSlide.addText(`Generated with ${questions.length} questions.`, { x: 0, y: 2.0, w: '100%', align: 'center', color: TEXT_COLOR, fontSize: 18 });

    // RESTORED: Filter text generation logic
    let filterTextForPpt = [];
    let hasFilters = false;
    for (const key in selectedFilters) {
        if (selectedFilters[key] && selectedFilters[key].length > 0) {
            hasFilters = true;
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
            filterTextForPpt.push({ text: `• ${capitalizedKey}: `, options: { bold: true } });
            filterTextForPpt.push({ text: selectedFilters[key].join(', ') + '\n' });
        }
    }

    if (hasFilters) {
        titleSlide.addText(
            [{ text: "Applied Filters:", options: { bold: true, fontSize: 16 } }, { text: '\n', options: { fontSize: 8 } }, ...filterTextForPpt],
            { x: 1.0, y: 2.8, w: '80%', h: 2, fontSize: 14, color: '363636', align: 'left' }
        );
    } else {
        titleSlide.addText(
            'No specific filters applied.',
            { x: 0, y: 3.0, w: '100%', align: 'center', color: '757575', fontSize: 16, italic: true }
        );
    }

    const totalQuestions = questions.length;
    for (let i = 0; i < totalQuestions; i++) {
        const question_item = questions[i];
        const slide_question_number = i + 1;

        // ... (All slide generation logic remains the same) ...
        // SLIDE 1: QUESTION & OPTIONS
        let q_slide = pptx.addSlide();
        q_slide.background = { color: QUESTION_SLIDE_BG };
        let question_text = cleanQuestionText(question_item.question);
        const examInfoText = ` (${question_item.examName}, ${question_item.examDateShift})`;
        const englishQuestionArray = [
            ...parseMarkdownForPptx(`Q.${slide_question_number}) ${question_text}`),
            { text: examInfoText, options: { fontSize: 12, color: 'C62828', italic: true } }
        ];
        q_slide.addText(englishQuestionArray, { x: 0.5, y: 0.3, w: 9, h: 1.2, fontFace: ENGLISH_FONT, fontSize: 20, color: TEXT_COLOR, bold: true });
        const question_text_hi = cleanQuestionText(question_item.question_hi);
        q_slide.addText(parseMarkdownForPptx(question_text_hi || ''), { x: 0.5, y: 1.5, w: 9, h: 0.6, fontFace: HINDI_FONT, fontSize: 18, color: TEXT_COLOR, bold: true });
        let optionsArray = [];
        (question_item.options || []).forEach((eng_option, index) => {
            const hin_option = (question_item.options_hi || [])[index] || '';
            const option_letter = String.fromCharCode(65 + index);
            const engParsed = parseMarkdownForPptx(`${option_letter}) ${eng_option}`);
            engParsed.forEach(p => { p.options = {...p.options, fontFace: ENGLISH_FONT, fontSize: 16, color: TEXT_COLOR }});
            optionsArray.push(...engParsed);
            const hinParsed = parseMarkdownForPptx(`    ${hin_option}\n`);
            hinParsed.forEach(p => { p.options = {...p.options, fontFace: HINDI_FONT, fontSize: 14, color: TEXT_COLOR }});
            optionsArray.push(...hinParsed);
        });
        q_slide.addText(optionsArray, { x: 0.6, y: 2.3, w: 9, h: 3.0, lineSpacing: 24 });

        // SLIDE 2 & 3: ANSWER & EXPLANATION
        const explanation = question_item.explanation || {};
        const slideParts = [
            { part: 1, title: `Answer & Explanation for Q.${slide_question_number} (Part 1)`, content: [ { text: `✅ Correct Answer: ${question_item.correct || 'N/A'}` }, explanation.analysis_correct, explanation.conclusion, ] },
            { part: 2, title: `Answer & Explanation for Q.${slide_question_number} (Part 2)`, content: [ explanation.analysis_incorrect, explanation.fact, ] }
        ];
        slideParts.forEach(partInfo => {
            const contentBlocks = partInfo.content.filter(Boolean);
            if (contentBlocks.length === 0) return;
            let aSlide = pptx.addSlide();
            aSlide.background = { color: ANSWER_SLIDE_BG };
            aSlide.addText(partInfo.title, { x: 0.5, y: 0.3, w: 9, h: 0.6, fontFace: ENGLISH_FONT, fontSize: 18, color: TEXT_COLOR, bold: true });
            let combinedExplanation = [];
            contentBlocks.forEach(block => {
                if (typeof block === 'string') {
                    combinedExplanation.push(...parseMarkdownForPptx(block));
                    combinedExplanation.push({ text: '\n\n' });
                } else if (block.text && block.text.includes('Correct Answer')) {
                    combinedExplanation.push({ text: block.text, options: { bold: true, color: CORRECT_ANSWER_COLOR } });
                    combinedExplanation.push({ text: '\n\n' });
                }
            });
            if (combinedExplanation.length > 0) {
                aSlide.addText(combinedExplanation, { x: 0.5, y: 1.1, w: 9, h: 4.2, fontFace: ENGLISH_FONT, fontSize: 14, color: TEXT_COLOR, lineSpacing: 22 });
            }
        });

        const progress = Math.round(((i + 1) / totalQuestions) * 100);
        self.postMessage({
            type: 'progress',
            value: progress,
            details: `Processing question ${slide_question_number} of ${totalQuestions}... (${progress}%)`
        });
    }

    // ... (Filename generation logic is the same) ...
    let filename = `Quiz_LM_${questions.length}Qs.pptx`; // Simplified filename for worker context

    const blob = await pptx.write('blob');
    self.postMessage({ type: 'result', format: 'ppt', blob: blob, filename: filename });
}


// --- PDF GENERATION (Adapted for Worker) ---
async function generatePDF(questions, selectedFilters) {
    const { jsPDF } = self.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const MARGIN = 40;
    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
    const COLUMN_1_X = MARGIN + 20;
    const COLUMN_2_X = MARGIN + (CONTENT_WIDTH / 2);

    // Define background colors
    const COLOR_BG_TITLE_ANSWER = '#f0fff0'; // Honeydew (Light Green)
    const COLOR_BG_QUESTION = '#f0f8ff';   // AliceBlue (Light Blue)

    let y = MARGIN;
    let pageNum = 1;

    const addPageBreakIfNeeded = (requiredHeight, context = 'question') => {
        if (y + requiredHeight > PAGE_HEIGHT - MARGIN) {
            doc.addPage();
            pageNum++;
            y = MARGIN;

            // Apply background color to the new page based on context
            const bgColor = context === 'answer' ? COLOR_BG_TITLE_ANSWER : COLOR_BG_QUESTION;
            doc.setFillColor(bgColor);
            doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

            return true;
        }
        return false;
    };

    const addFooter = (doc, pageNum, totalPages) => {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text('Compiler: Aalok Kumar Sharma', MARGIN, PAGE_HEIGHT - 20);
        doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 20, { align: 'right' });
    };

    // --- Title Page ---
    doc.setFillColor(COLOR_BG_TITLE_ANSWER);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F'); // Fill the background

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('Quiz LM - Custom Question Set', PAGE_WIDTH / 2, y, { align: 'center' });
    y += 40;

    doc.setFontSize(14);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, PAGE_WIDTH / 2, y, { align: 'center' });
    y += 20;
    doc.text(`Total Questions: ${questions.length}`, PAGE_WIDTH / 2, y, { align: 'center' });
    y += 40;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Applied Filters:', MARGIN, y);
    y += 25;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    let filterText = '';
    for (const key in selectedFilters) {
        if (selectedFilters[key] && selectedFilters[key].length > 0) {
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
            filterText += `${capitalizedKey}: ${selectedFilters[key].join(', ')}\n`;
        }
    }
    if (filterText.trim() === '') {
        filterText = 'No specific filters applied (all questions).';
    }
    const filterLines = doc.splitTextToSize(filterText, CONTENT_WIDTH);
    doc.text(filterLines, MARGIN, y);

    const answers = [];

    // --- Questions Loop ---
    if (questions.length > 0) {
        doc.addPage();
        pageNum++;
        y = MARGIN;
        // Apply background to the first question page
        doc.setFillColor(COLOR_BG_QUESTION);
        doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');
    }

    for (let i = 0; i < questions.length; i++) {
        const question_item = questions[i];
        const questionNum = i + 1;

        const progress = Math.round((i / questions.length) * 50);
        self.postMessage({ type: 'progress', value: progress, details: `Processing question ${questionNum} of ${questions.length}...` });

        // Prepare answer key entry
        let letteredCorrect = '?';
        let correctTextToPush = 'Answer not found';
        const correctOptIndexFromText = (question_item.options || []).indexOf(question_item.correct);
        if (correctOptIndexFromText !== -1) {
            letteredCorrect = String.fromCharCode(65 + correctOptIndexFromText);
            correctTextToPush = question_item.correct;
        }
        answers.push(`${questionNum}. ${letteredCorrect}) ${correctTextToPush}`);

        const cleanQ = cleanQuestionText(question_item.question);
        const questionText = `Q.${questionNum}) ${cleanQ}`;

        // HTML-aware rendering
        const preMatch = /<pre>([\s\S]*?)<\/pre>/i.exec(questionText);
        if (preMatch) {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(12);

            const beforePre = questionText.substring(0, preMatch.index).trim();
            const preContent = preMatch[1];

            const beforeLines = doc.splitTextToSize(beforePre.replace(/<br\s*\/?>/gi, '\n'), CONTENT_WIDTH);
            addPageBreakIfNeeded(beforeLines.length * 12 * 1.2, 'question');
            doc.text(beforeLines, MARGIN, y);
            y += (beforeLines.length * 12 * 1.2);

            if (preContent) {
                doc.setFont('Courier', 'normal');
                doc.setFontSize(10);
                const preLines = preContent.trim().split('\n');

                addPageBreakIfNeeded(preLines.length * 12 + 10, 'question');
                let startY = y;
                let col1Height = 0;
                let col2Height = 0;

                preLines.forEach(line => {
                    addPageBreakIfNeeded(12, 'question');
                    const columns = line.trim().split(/\s{2,}/); // Split by 2 or more spaces

                    if (columns.length === 2) {
                        const col1Lines = doc.splitTextToSize(columns[0], CONTENT_WIDTH / 2 - 20);
                        const col2Lines = doc.splitTextToSize(columns[1], CONTENT_WIDTH / 2 - 20);

                        doc.text(col1Lines, COLUMN_1_X, y);
                        doc.text(col2Lines, COLUMN_2_X, y);

                        const lineHeight = Math.max(col1Lines.length, col2Lines.length) * 12;
                        y += lineHeight;
                    } else {
                        doc.text(line, COLUMN_1_X, y);
                        y += 12;
                    }
                });
                y += 10;
            }
        } else {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(12);
            const processedQuestionText = questionText.replace(/<br\s*\/?>/gi, '\n');
            const questionLines = doc.splitTextToSize(processedQuestionText, CONTENT_WIDTH);

            addPageBreakIfNeeded(questionLines.length * 12 * 1.2 + 10, 'question');
            doc.text(questionLines, MARGIN, y);
            y += (questionLines.length * 12 * 1.2) + 10;
        }

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        (question_item.options || []).forEach((opt, idx) => {
            const optionText = `(${String.fromCharCode(65 + idx)}) ${opt}`;
            const optionLines = doc.splitTextToSize(optionText, CONTENT_WIDTH - 20);
            const optionHeight = (optionLines.length * 10 * 1.2) + 5;

            addPageBreakIfNeeded(optionHeight, 'question');
            doc.text(optionLines, MARGIN + 20, y);
            y += optionHeight;
        });

        y += 15;
        addPageBreakIfNeeded(20, 'question');
        doc.setDrawColor(220);
        doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
        y += 20;
    }

    // --- Answer Key Page ---
    if (answers.length > 0) {
        doc.addPage();
        pageNum++;
        y = MARGIN;
        // Apply background to the first answer key page
        doc.setFillColor(COLOR_BG_TITLE_ANSWER);
        doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Answer Key', PAGE_WIDTH / 2, y, { align: 'center' });
        y += 30;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);

        const col1_x = MARGIN;
        const col2_x = PAGE_WIDTH / 2 + 20;
        let current_y = y;

        const half = Math.ceil(answers.length / 2);

        for (let i = 0; i < answers.length; i++) {
            const progress = 50 + Math.round(((i + 1) / answers.length) * 50);
            self.postMessage({ type: 'progress', value: progress, details: `Generating Answer Key... (${i+1}/${answers.length})` });

            const isCol1 = i < half;
            const x = isCol1 ? col1_x : col2_x;
            if (!isCol1 && i === half) {
                current_y = y;
            }

            const answerLines = doc.splitTextToSize(answers[i], (PAGE_WIDTH / 2) - MARGIN - 20);

            if (current_y + (answerLines.length * 10 * 1.2) > PAGE_HEIGHT - MARGIN) {
                doc.addPage();
                pageNum++;
                // Apply background to subsequent answer key pages
                doc.setFillColor(COLOR_BG_TITLE_ANSWER);
                doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');
                current_y = MARGIN;
                y = MARGIN;
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(18);
                doc.text('Answer Key (Continued)', PAGE_WIDTH / 2, current_y, { align: 'center' });
                current_y += 30;
                y += 30;
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(10);
            }

            doc.text(answerLines, x, current_y);
            current_y += (answerLines.length * 10 * 1.2) + 5;
        }
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(doc, i, totalPages);
    }

    // --- Dynamic Filename Generation ---
    let filenameParts = [];

    // Part 1: Subject
    if (selectedFilters.subject && selectedFilters.subject.length > 0) {
        if (selectedFilters.subject.length === 1) {
            filenameParts.push(selectedFilters.subject[0].replace(/\s+/g, '_'));
        } else {
            filenameParts.push('Multiple_Subjects');
        }
    } else {
        filenameParts.push('General_Quiz');
    }

    // Part 2: Exam Name
    if (selectedFilters.examName && selectedFilters.examName.length > 0) {
        if (selectedFilters.examName.length === 1) {
            filenameParts.push(selectedFilters.examName[0].replace(/\s+/g, '_'));
        } else {
            filenameParts.push('Multiple_Exams');
        }
    }

    // Part 3: Question Count
    filenameParts.push(`${questions.length}Qs`);

    const filename = filenameParts.join('_') + '.pdf';

    const blob = doc.output('blob');
    self.postMessage({ type: 'result', format: 'pdf', blob: blob, filename: filename });
}
