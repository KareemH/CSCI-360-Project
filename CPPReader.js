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
//variables[2][0] = ["i","DWORD PTR [rbp-4]", 4, int]
//variables[2][0][0] = "i"	(variable name)
//variables[2][0][1] = "DWORD PTR [rbp-4]"	(asembly code)
//variables[2][0][2] = 4 	(size)
//variables[2][0][3] = int 	(type)
var hasVoidReturnType = true; //used to deturmin if a function has a void ruturn type
// @cppCode: called from demo.js testRegExClick() function, contains the C++ code in index.html
function regExTest(cppCode) {
	var result = '';
	// console.log(cppCode.length);
	// console.log(cppCode);
	while (cppCode.length > 0 /*&& lineType != "empty"*/) {
		var line = getFirstLine(cppCode);
		//console.log(line);
		var lineType = getLineType(line);
		//var lineType = "";
		if (lineType === "empty") {
			break;
		}
		result = result + (lineType) + ('\t') + (line) + ('\n');
		// if(line.length == 0){
		// 	cppCode = cppCode.substring(1);	//This is a quick fix to reach the end of cppCode when a character is not recognized.
		// }
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
	} else return 'empty'; 	//returns 'empty' if nothing is recognized. Does not mean that line is empty. 
	//There should be a check before for an empty line before running this method.
}
function convertToAssembly(cppCode) {
	var result = '';
	var labelNum = 0;
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
		} else if (lineType == 'else') {
			result = removeLastLine(result);
			result = result + '\n' + writeJump(labelNum);
			labelNumberStack.push(labelNum);
			labelNum--;
			result = result + '\n' + writeLabel(labelNum);
			labelNum += 2;
			nestedStatementStack.push('else');
			if (hasNoOpenBracket(line)) {
				scopeLvl++;
				nestedStatementStack.push('no brackets');
			}
		} else if (lineType == 'if statment') {
			result = result + '\n' + writeIfStatment(line, labelNum);
			nestedStatementStack.push('if statement');
			labelNumberStack.push(labelNum);
			labelNum++;
			if (hasNoOpenBracket(line)) {
				scopeLvl++;
				nestedStatementStack.push('no brackets')
			}
		} else if (lineType == 'for loop') {
			scopeLvl++;
			result = result + '\n' + writeForLoopInrementInitializer(line);
			result = result + '\n' + writeLabel(labelNum);
			loopJumpStack.push(labelNum);
			labelNum++;
			result = result + '\n' + writeForLoopConition(line, labelNum);
			nestedStatementStack.push('for loop');
			labelNumberStack.push(labelNum);
			labelNum++;
			forLoopIncrentStack.push(getForLoopInrement(line));
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
					popScope();
					result = result + '\n' + writeLabel(labelNumberStack.pop());
					nestedStatementStack.pop();
				}
			}
		} else if (lineType == 'close bracket') {
			popScope();
			if (nestedStatementStack.length > 0) {
				if (nestedStatementStack.lastIndexOf('for loop') == (nestedStatementStack.length - 1)) {
					result = result + '\n' + writeIncrement(forLoopIncrentStack.pop());
					result = result + '\n' + writeJump(loopJumpStack.pop());
				}
				result = result + '\n' + writeLabel(labelNumberStack.pop());
				nestedStatementStack.pop();
				while (nestedStatementStack.lastIndexOf('no brackets') == (nestedStatementStack.length - 1)) {
					popScope();
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
//removes variables of current scope and reduces scopeLvl by 1.
function popScope() {
	variables[scopeLvl] = [[]];
	scopeLvl--;
}
//writes the for loop initializer ex: for(int i = 0; i<10;i++) will write the int i = 0; part.
function writeForLoopInrementInitializer(line) {
	var part1RegEx = /\s*for\s*\(\s*/; 	//part before the increment initializer
	var part2RegEx = /;.*/;		//part after the increment initializer
	var forLoopInitializer = line.replace(part1RegEx, "").replace(part2RegEx, "");
	return writeInstruction(forLoopInitializer);
}

//returns the for loop increment. ex: for(int i = 0; i<10;i++) will return the i++ part.
function getForLoopInrement(line) {
	var part1RegEx = /.*;.*;\s*/; 	//part before the increment
	var part2RegEx = /\s*\).*/;		//part after the increment
	return line.replace(part1RegEx, "").replace(part2RegEx, "");	//returns the increment part
}

//returns the for loop condition. ex: for(int i = 0; i<10;i++) will return the i<0 part.
function writeForLoopConition(line, labelNum) {
	var result = '';
	var condition = line.split(';')[1];
	var split = /\w/.exec(condition);
	leftPart = split[0];
	rightPart = split[1];
	result = 'mov eax, ' + getValue(leftPart);
	result = result + '/ncmp eax, ' + getValue(rightPart);
	result = result + writeCompare(condition);
	return result;
}
function writeCompare(condition) {
	var result = '';
	if (/</.test(condition)) {
		result = '/njge L' + labelNum;
	}
	if (/<=/.test(condition)) {
		result = '/njg L' + labelNum;
	}
	if (/>/.test(condition)) {
		result = '/njle L' + labelNum;
	}
	if (/>=/.test(condition)) {
		result = '/njl L' + labelNum;
	}
	if (/==/.test(condition)) {
		result = '/njne L' + labelNum;
	}
	if (/!=/.test(condition)) {
		result = '/nje L' + labelNum;
	}
	return result;
}
function hasNoOpenBracket(line) {
	return !(/.*\{/.test(line));
}
function writeIncrement(increment) {
	//TODO write the for loop increment
	var incrementName = /\w/.exec(cppCode)[0];
	var result = '';
	if (/\+\+/.test(increment)) {
		result = writeInstruction(incrementName + ' = ' + incrementName + ' + ' + '1;');
	} else if (/\+=/.test(increment)) {
		var rightPart = increment.split('=')[1].replace(/s|;/, '');
		var val = getValue(rightPart);
		result = writeInstruction(incrementName + ' = ' + incrementName + ' + ' + val + ';');
	} else if (/--/.test(increment)) {
		result = writeInstruction(incrementName + ' = ' + incrementName + ' - ' + '1;');
	} else if (/-=/.test(increment)) {
		var rightPart = increment.split('=')[1].replace(/s|;/, '');
		var val = getValue(rightPart);
		result = writeInstruction(incrementName + ' = ' + incrementName + ' - ' + val + ';');
	}
	return result;
}

function writeInstruction(line) {
	var result = '';
	if (/=/.test(line)) {	//checks for assignment instruction
		result = writeAssignmentInstruction(line);
	} else if (/.*\w\(.*\).*/.test(line)) {
		result = writeFunctionCall(line);
	} else if (/cin/.test(line)) {
		result = writeCin(line);
	} else if (/cout/.test(line)) {
		result = writeCout(line);
	} else if (/return/.test(line)) {
		result = writerReturn(line);
	} else if (/(\+\+)|(--)|(\+=)|(-=)/.test(line)) {
		writeIncrement(line);
	}
	return result;
}
function writerReturn(line) {
	var result = '';
	var opperators = /[\/\+\-\*]/.exec(line);
	var opperands = /w/.exec(line);
	var opperatorCount = opperators.length;
	if (opperatorCount > 0) {
		var valueA = opperands[1];
		var valueB = opperands[2];
		result = writeOpperation(valueA, valueB, opperators[0]);
		var termNum = 3;
		while (termNum < (opperatorCount - 2)) {
			valueB = getValue(opperands[termNum]);
			result = result + writeChainOpperation(valueB, opperators[termNum - 2])
			termNum++;
		}
	} else {
		result = 'mov eax, ' + getValue(opperands[1]);
	}
	return result;
}
function writeFunctionCall(line) {
	var result = '';
	var functionName = /w/.exec(line)[0] + '(';
	var parameter = line.split('(')[1];
	parameter = /(\w+|,)*/;
	var parameterArray = parameter.split(',');
	var paramIndex = parameterArray.length;

	while (paramIndex > 0) {
		paramIndex--;
		if (paramIndex > 5) {
			result = result + 'mov eax, ' + getValue(parameterArray[paramIndex]);
			result = result + '/npush rax/n';
		} else if (paramIndex == 5) {
			result = result + 'mov r9d, ' + getValue(parameterArray[paramIndex]) + '/n';
		} else if (paramIndex == 4) {
			result = result + 'mov r8d, ' + getValue(parameterArray[paramIndex]) + '/n';
		} else if (paramIndex == 3) {
			result = result + 'mov ecx, ' + getValue(parameterArray[paramIndex]) + '/n';
		} else if (paramIndex == 2) {
			result = result + 'mov edx, ' + getValue(parameterArray[paramIndex]) + '/n';
		} else if (paramIndex == 1) {
			result = result + 'mov esi, ' + getValue(parameterArray[paramIndex]) + '/n';
		} else if (paramIndex == 0) {
			result = result + 'mov edi, ' + getValue(parameterArray[paramIndex]) + '/n';
		}
		functionName = functionName + getDataType(parameterArray[paramIndex]) + ',';
	}
	if (parameterArray.length > 0) {
		functionName = functionName.substr(0, lenght - 1) + ')';
	} else {
		functionName = functionName + ')';
	}
	return result + '/n' + functionName;
}
function writeCin(line) {
	var result = '';
	return result;
}
function writeCout(line) {
	var result = '';
	return result;
}

function writeAssignmentInstruction(line) {
	var result = '';
	var splitLine = line.split("=");
	var leftPart = splitLine[0];
	var rightPart = splitLine[1];
	let split = leftPart.split(/\s+/);		//splits the left part of the '=' into an array of words.
	let varName = split.pop();				//last word in split is the variable name.
	if (/\w+\s+\w+/.test(leftPart)) {	//checks if variable is being declared
		let dataTaype = split.pop();	//next last word in split is the data type.
		addVar(varName, dataTaype);
	}
	//will ignore order of opperations and parenthises and function call.
	var opperators = /[\/\+\-\*]/.exec(rightPart);
	var opperands = /w/.exec(rightPart);
	var opperatorCount = opperators.length;
	if (opperatorCount > 0) {
		var valueA = opperands[0];
		var valueB = opperands[1];
		result = writeOpperation(valueA, valueB, opperators[0]);
		var termNum = 2;
		while (termNum <= opperatorCount) {
			valueB = getValue(opperands[termNum]);
			result = result + writeChainOpperation(valueB, opperators[termNum - 1])
			termNum++;
		}
		result = result + '/nmov ' + getVariableDword(varName) + ', eax';
	}
	else result = 'mov ' + getVariableDword(varName) + ', ' + getValue(opperands[0]);
	return result;
}

//writes the first or only opperation in a line.
function writeOpperation(valueA, valueB, opperator) {
	var result = 'mov eax, ' + valueA + '/n mov edx, ' + valueB;
	if (/\+/.test(opperator)) {
		result = result + '/nadd eax, edx'
	}
	if (/-/.test(opperator)) {
		result = result + '/nsub eax, edx'
	}
	if (/\//.test(opperator)) {
		result = result + '/ncdq/nidiv edx'
	}
	if (/\*/.test(opperator)) {
		result = result + '/nimul eax, edx'
	}
	return result;
}
//when you have a more then one opperation on a line, you need to use the chain opperation to link the additonal opperations to the first one.
function writeChainOpperation(valueB, opperator) {
	var result = 'mov edx, ' + valueB;
	if (/\+/.test(opperator)) {
		result = result + '/nadd eax, edx'
	}
	if (/-/.test(opperator)) {
		result = result + '/nsub eax, edx'
	}
	if (/\//.test(opperator)) {
		result = result + '/ncdq/nidiv edx'
	}
	if (/\*/.test(opperator)) {
		result = result + '/nimul eax, edx'
	}
	return result;
}
function addVar(varName, dataTaype) {
	let varSize = getVarSize(dataTaype);
	let offset = getLastVarOffset() + varSize;
	variables[scopeLvl].push([varName, `DWORD PTR [rbp-${offset}]`, varSize, dataTaype]); //adds the variable for use.
}

//returns the value of the oppereand, either a litteral value or the DWORD of the variable
function getValue(opperand) {
	if (/d/.test(opperand)) {
		return opperand;
	}
	else {
		return getVariableDword(opperand);
	}
}//Finds the DWORD of the variable by name. Returns an empty string if not found.
function getVariableDword(varName) {
	var scope = scopeLvl;
	while (scope >= 0) {
		variables[scopeLvl].forEach(variable => {
			if (variable[0] == varName) {
				return variable[0];
			}
		});
		scope--;
	}
	return '';
}
function getDataType(varName) {
	var scope = scopeLvl;
	while (scope >= 0) {
		variables[scopeLvl].forEach(variable => {
			if (variable[0] == varName) {
				return variable[3];
			}
		});
		scope--;
	}
	return '';
}

function getVarSize(dataTaype) {
	if (dataTaype == 'double') {			//other checks for data types may be added here.
		return 8;
	}
	else {
		return 4;
	}
}
//checks the last memory space used in the local scope level. Reminder: scopeLvl 0 is for global variables. 
function getLastVarOffset() {
	let max = 0;
	var scope = scopeLvl;
	while (scope > 0) {
		variables[scopeLvl].forEach(variable => {
			if (variable[2] > max) {
				max = variable[2];
			}
		});
		scope--;
	}
	return max;
}

function writeIfStatment(line, labelNum) {
	//TODO writes the if statement condition and jump. Difficulty level: medium
	var result = '';
	var condition = /(.*)/.exec(line);
	var split = /\w/.exec(condition);
	leftPart = split[0];
	rightPart = split[1];
	result = 'mov eax, ' + getValue(leftPart);
	result = result + '/ncmp eax, ' + getValue(rightPart);
	result = result + writeCompare(condition);
	return result;
}
function writeLabel(labelNum) {
	return `L${labelNum}:\n`;
}
function writeJump(labelNum) {
	//write a jump instruction to the label number
	return `JMP L${labelNum}\n`;
}
function removeLastLine(asmCode) {
	//removes the last line of assembly code
	let index = asmCode.length - 1;
	while (index > 0) {
		index--;	//skips the last character of asmcode and waits for the next '\n' charcter.
		if (asmCode[index] == '\n') {
			index--;	//index of end of previous line
			asmCode = asmCode.substring(0, index);	//substring without last line
			index = 0;	//set index to 0 to end loop
		}
	}
	return asmCode;
}

function getMemSize(cppCode) {
	//TODO return the amount of memory needed for the function. Counts all memory needed for all variables and parameters and arrays of any size.
	var findInitializedArray = /[A-Za-z]+\[\d+\]/; //Code below finds memory size needed for an array up to ten ints.
	var foundArray = cppCode.match(findInitializedArray);
	// console.log(foundArray[0]);
	var determineMemory = foundArray[0].match(/\d+/)[0];
	var memoryNeeded = 0;
	if (determineMemory == (0 || 1)) { memoryNeeded = 16; }
	else if (determineMemory == 3 || determineMemory == 4 || determineMemory == 5 || determineMemory == 6) { memoryNeeded = 16 * 2; }
	else if (determineMemory == 7 || determineMemory == 8 || determineMemory == 9 || determineMemory == 10) { memoryNeeded = 16 * 3; }
	//end of memory size needed for an array up to ten ints.
	return memoryNeeded;
}

function writeFunctionHeader(line) {
	//TODO writes the function header and memory declaration and pushes parameters to stack
	///(\w+\s+)?\w+\s+\w+\s*\(((\s*const\s)?\s*\w+((\s*(\*|&)\s*)|\s+)\w+\s*(,(\s*const\s)?\s*\w+((\s*(\*|&)\s*)|\s+)\w+\s*)*)?\)\s*\{/;
	var result = '';
	var accesorReturnTypeName = /(\w+\s+)?\w+\s+\w+\s*\(/.exec(line)[0].split(/\s+/);
	var functionName = accesorReturnTypeName.pop();
	var returnType = accesorReturnTypeName.pop();
	if (returnType == 'void') {
		hasVoidReturnType = true;
	} else {
		hasVoidReturnType = false;
	}
	var parameterRegex = /\(((\s*const\s)?\s*\w+((\s*(\*|&)\s*)|\s+)\w+\s*(,(\s*const\s)?\s*\w+((\s*(\*|&)\s*)|\s+)\w+\s*)*)?\)/;
	var parameterArray = parameterRegex.exec(line)[0].split(',');
	for (let index = parameterArray.length; index <= 0; index--) {
		parameter = parameterArray[index];
		split = parameter.split(/\s+/);
		var varName = split.pop();
		var dataTaype = split.pop();
		addVar(varName, dataTaype);
		if (paramIndex > 5) {
			result = result + 'mov ' + getValue(parameterArray[paramIndex]) + ', eax';
			result = result + '/npush rax/n';
		} else if (paramIndex == 5) {
			result = result + 'mov ' + getValue(parameterArray[paramIndex]) + ', r9d/n';
		} else if (paramIndex == 4) {
			result = result + 'mov ' + getValue(parameterArray[paramIndex]) + ', r8b/n';
		} else if (paramIndex == 3) {
			result = result + 'mov ' + getValue(parameterArray[paramIndex]) + ', ecx/n';
		} else if (paramIndex == 2) {
			result = result + 'mov ' + getValue(parameterArray[paramIndex]) + ', edx/n';
		} else if (paramIndex == 1) {
			result = result + 'mov ' + getValue(parameterArray[paramIndex]) + ', esi/n';
		} else if (paramIndex == 0) {
			result = result + 'mov  ' + getValue(parameterArray[paramIndex]) + ', edi';
		}
		functionName = functionName + getDataType(parameterArray[paramIndex]) + ',';
	}
	if (parameterArray.length > 0) {
		functionName = functionName.substr(0, functionName.lenght - 1) + ')';
	} else {
		functionName = functionName + ')';
		return functionName + '/n' + result;
	}

	return result;
}
function writeEndOfFunction() {
	//TODO writes the end of function depending on the return type
	if (hasVoidReturnType) {
		return '/nnop/npop rbp/nret';
	}
	else {
		return '/npop rbp/nret';
	}
}