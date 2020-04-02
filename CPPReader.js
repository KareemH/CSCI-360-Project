var ifRegEx = /if\(.*?\)\s*\{?/; //matches if(anything) and any white space and optional "{"
var elseRegEx = /else\s*\{?/;    //matches else and optional "{"
var functionHeaderRegEx = /(\w+\s+)?\w+\s+\w+\s*\(((\s*const\s)?\s*\w+((\s*(\*|&)\s*)|\s+)\w+\s*(,(\s*const\s)?\s*\w+((\s*(\*|&)\s*)|\s+)\w+\s*)*)?\)\s*\{/; //matches optional access modifier with 
//at least one white space and return type with at least one white space and function name with any number of white space 
//and "(" with any number of white space and any number of parameters (any word with at least one white space and anyword 
//with any number of white space) separated by ","and ")" and any number of white space and "{"
var forLoopRegEx = /for\s*\(.*\)\s*\{?/; //matches for(anyting) and optional "{"
var instructionRegEx = /.*;/; 	//matches anything ending with ";"
//only useful when all other regular expressions failed
var closeBracketRegEx = /\}/;
/*
At this point, this project is able to recognize some C++ code. Does not recognize comments or while loops. 
Does something weird when it reaches the end of the C++ code. It has trouble removing the last line of cppCode 
and I am forced to use substring(1) to removed unrecognized characters one by one. This is not ideal and a fix will be needed.
*/
var scopeLvl = 0;
var variables = [[[]]];	//3d array for variables in c++ code. Outer array is for picking the scope.
//Inner array is the list of variable name and space name pairs in the scope
//First array would be the global variables
//Second array would be the variables of a function.
//Additional arrays would be in the scope of nested statments.
//Global variables should be stored in a label.
//example: Line 8 in main.cpp has int i = 0;. i will be stored in DWORD PTR [rbp-4]
//This is scopelvl 2 because int i is declaired in the for loop and cannot be accesed after the loop.
//variables[2][0] = ["i","DWORD PTR [rbp-4]"]
//variables[2][0][0] = "i"
//variables[2][0][1] = "DWORD PTR [rbp-4]"

function regExTest(cppCode) {
	var result = '';
	while (cppCode.length > 0) {
		var line = getFirstLine(cppCode);
		var lineType = getLineType(line);
		result = result + (lineType) + ('\t') + (line) + ('\n');
		if (line.length == 0) {
			cppCode = cppCode.substring(1);	//This is a quick fix to reach the end of cppCode when a character is not recognized.
		}
		cppCode = cppCode.replace(line, '');
	}
	return result;
}

var getFirstLine = function (cppCode) {
	cppCode = cppCode.replace(/^\s+/g, ""); //removes leading whitspace
	if (cppCode.search(ifRegEx) == 0) {
		return ifRegEx.exec(cppCode)[0];
	} else if (cppCode.search(elseRegEx) == 0) {
		return elseRegEx.exec(cppCode)[0];
	} else if (cppCode.search(functionHeaderRegEx) == 0) {
		return functionHeaderRegEx.exec(cppCode)[0];
	} else if (cppCode.search(forLoopRegEx) == 0) {
		return forLoopRegEx.exec(cppCode)[0];
	} else if (cppCode.search(closeBracketRegEx) == 0) {
		return closeBracketRegEx.exec(cppCode)[0];
	} else if (cppCode.search(instructionRegEx) == 0) {
		return instructionRegEx.exec(cppCode)[0];
	} else return "";
}

var removeFirstLine = function (cppCode) {
	cppCode = cppCode.replace(/^\s+/g, ""); //removes leading whitspace
	cppCode = cppCode.replace(getFirstLine(cppCode), "");
	return cppCode;
}

var getLineType = function (line) {
	if (ifRegEx.test(line)) {
		return 'if statment';
	} else if (elseRegEx.test(line)) {
		return 'else statment';
	} else if (functionHeaderRegEx.test(line)) {
		return 'function header';
	} else if (forLoopRegEx.test(line)) {
		return 'for loop';
	} else if (closeBracketRegEx.test(line)) {
		return 'close bracket';
	} else if (instructionRegEx.test(line)) {
		return 'instruction';
	} else return 'empty';
}
function convertToAssembly(cppCode) {
	var result = '';
	var lableNum = 0;
	var returnType = '';
	var labelNumberStack = [];
	var nestedStatementStack = [];
	var forLoopIncrentStack = [];
	var loopJumpStack = [];
	var line = '';
	while (cppCode.length != 0) {
		line = getFirstLine(cppCode);
		cppCode = cppCode.replace(line, '');
		var lineType = getLineType(line);
		if (lineType == 'function header') {
			scopeLvl++;
			let memSize = getMemSize(cppCode);
			result = result + '\n' + writeFunctionHeader(line, memSize);
			returnType = getReturnType(line);
		} else if (lineType == 'else') {
			result = removeLastLine(result);
			result = result + '\n' + writeJump(lableNum);
			labelNumberStack.push(lableNum);
			lableNum--;
			result = result + '\n' + writeLable(lableNum);
			lableNum += 2;
			nestedStatementStack.push('else');
			if (hasNoOpenBracket(line)) {
				nestedStatementStack.push('no brackets');
			}
		} else if (lineType == 'if statment') {
			result = result + '\n' + writeIfStatment(line, lableNum);
			nestedStatementStack.push('if statement');
			labelNumberStack.push(labelNum);
			labelNum++;
			if (hasNoOpenBracket(line)) {
				nestedStatementStack.push('no brackets')
			}
		} else if (lineType == 'for loop') {
			scopeLvl++;
			result = result + '\n' + writeLable(labelNum);
			loopJumpStack.push(labelNum);
			labelNum++;
			result = result + '\n' + writeForLoop(line, lableNum);
			nestedStatementStack.push('for loop');
			labelNumberStack.push(labelNum);
			labelNum++;
			forLoopIncrentStak.push(getForLoopInrement(line));
			if (hasNoOpenBracket(line)) {
				nestedStatementStack.push('no brackets');
			}
		} else if (lineType == 'instruction') {
			result = result + '\n' + writeInstruction(line);
			while (nestedStatementStack.lastIndexOf('no brackets') == (nestedStatementStack.length - 1)) {
				nestedStatementStack.pop();
				if (nestedStatementStack.lastIndexOf('for loop') == (nestedStatementStack.length - 1)) {
					result = result + '\n' + writeIncrement(forLoopIncrentStack.pop());
					result = result + '\n' + writeJump(loopJumpStack.pop());
				}
				scopeLvl--;
				result = result + '\n' + writeLabel(labelNumberStack.pop());
				nestedStatementStack.pop();
			}
		} else if (lineType == 'close bracket') {
			scopeLvl--;
			if (nestedStatementStack.length > 0) {
				if (nestedStatementStack.lastIndexOf('for loop') == (nestedStatementStack.length - 1)) {
					result = result + '\n' + writeIncrement(forLoopIncrentStack.pop());
					result = result + '\n' + writeJump(loopJumpStack.pop());
				}
				result = result + '\n' + writeLabel(labelNumberStack.pop());
				nestedStatementStack.pop();
				while (nestedStatementStack.lastIndexOf('no brackets') == (nestedStatementStack.length - 1)) {
					scopeLvl--;
					nestedStatementStack.pop();
					if (nestedStatementStack.lastIndexOf('for loop') == (nestedStatementStack.length - 1)) {
						result = result + '\n' + writeIncrement(forLoopIncrentStack.pop());
						result = result + '\n' + writeJump(loopJumpStack.pop());
					}
					result = result + '\n' + writeLabel(labelNumberStack.pop());
					nestedStatementStack.pop();
				}
			} else {
				result = result + '\n' + WriteEndOfFunction(returnType);	//no nested statement means end of function 
			}
		}
	}
	return result;
}
//writes the for loop initializer ex: for(int i = 0; i<10;i++) will write the int i = 0; part.
function getForLoopInrement(line) {
	var beforeRegEx = /\s*\(\s*/; 	//part before the increment initializer
	var afterRegEx = /;.*/;		//part after the increment initializer
	var forLoopInitializer = line.replace(part1RegEx, "").replace(part2RegEx, "");
	return writeInstruction(forLoopInitializer);
}

//returns the for loop increment. ex: for(int i = 0; i<10;i++) will return the i++ part.
function getForLoopInrement(line) {
	beforeRegEx = /.*;.*;\s*/; 	//part before the increment
	afterRegEx = /\s*\).*/;		//part after the increment
	return line.replace(part1RegEx, "").replace(part2RegEx, "");	//returns the increment part
}

function hasNoOpenBracket(line) {
	return !(/.*\{/.test(line));
}
function writeIncrement(increment) {
	//TODO write the for loop increment
	variables[scopeLvl].push(getVariable(increment));
	return '';
}
function writeInstruction(line) {
	//TODO writes an instruction in assembly. Difficulty level hard.
	return '';
}
function writeIfStatment(line, labelNum) {
	//TODO writes the if statement condition and jump. Difficulty level: medium
	return '';
}
function writeLabel(lableNum) {
	return `L${lableNum}:`;
}
function writeJump(labelNum) {
	//TODO write a jump instruction to the lable number
	return '';
}
function removeLastLine(asmCode) {
	//TODO removes the last line of assembly code
	return '';
}
function getReturnType(cppCode) {
	//TODO check if return type is void or int or double. 
	return 'void';
}
function getMemSize(cppCode, memSize) {
	//TODO return the amount of memory needed for the function. Difficulty level: hard
	return 0;
}
function writeFunctionHeader(cppCode) {
	//TODO writes the function header and memory declaration and pushes parameters to stack
	return '';
}
function writeEndOfFunction(returnType) {
	//TODO writes the end of function depending on the return type
	return '';
}