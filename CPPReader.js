var ifRegEx = /if\(.*?\)\s*\{?/; //matches if(anything) and any white space and optional "{"
var elseRegEx = /else\s*\{?/; //matches else and optional "{"
var functionHeaderRegEx = /(\w+\s+)?\w+\s+\w+\s*\(((\s*const\s)?\s*\w+((\s*(\*|&)\s*)|\s+)\w+\s*(,(\s*const\s)?\s*\w+((\s*(\*|&)\s*)|\s+)\w+\s*)*)?\)\s*\{/; //matches optional access modifier with
//at least one white space and return type with at least one white space and function name with any number of white space
//and "(" with any number of white space and any number of parameters (any word with at least one white space and anyword
//with any number of white space) separated by ","and ")" and any number of white space and "{"
var forLoopRegEx = /for\s*\(.*\)\s*\{?/; //matches for(anyting) and optional "{"
var instructionRegEx = /.*;/; //matches anything ending with ";"
//only useful when all other regular expressions failed
var closeBracketRegEx = /\}/;
/*
At this point, this project is able to recognize some C++ code. Does not recognize comments or while loops.
Does something wierd when it reaches the end of the C++ code. It has trouble removing the last line of cppCode
and I am forced to use substring(1) to removed unrecognized characters one by one. This is not ideal and a fix will be needed.
*/
// @cppCode: called from demo.js testRegExClick() function, contains the C++ code in index.html
function regExTest(cppCode) {
  var result = '';
  // console.log(cppCode.length);
  // console.log(cppCode);
  while (cppCode.length > 0 /*&& lineType != "empty"*/ ) {
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

var getFirstLine = function(cppCode) {
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
};

var removeFirstLine = function(cppCode) {
  cppCode = cppCode.replace(/^\s+/g, ""); //removes leading whitspace
  cppCode = cppCode.replace(getFirstLine(cppCode), "");
  return cppCode;
};

var getLineType = function(line) {
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
};

function convertToAssembly(cppCode) {
  var result = '';
  var labelNum = 0;
  var returnType = '';
  var labelNumberStack = [];
  var nestedStatementStack = [];
  var forLoopIncrentStack = [];
  var loopJumpStack = [];
  var line = '';

  while (cppCode.length != 0) {
    line = getFirstLine(cppCode); // Extract the current, top most line of CPP code
    cppCode = cppCode.replace(line, ''); // Replace the current, top most line with an empty string to look at the next line on the next iteration
    var lineType = getLineType(line); // Get the line type of the current line

    if (lineType == 'function header') {
			console.log(line);
      let memSize = getMemSize(cppCode);
			console.log(memSize);
      result.concat('\n').concat(writeFunctionHeader(line, memSize));
      returnType = getReturnType(line);
    } else if (lineType == 'else') {
      result = removeLastLine(result);
      result.concat('\n').concat(writeJump(labelNum));
      labelNumberStack.push(labelNum);
      labelNum--;
      result.concat('\n').concat(writelabel(labelNum));
      labelNum += 2;
      nestedStatementStack.push('else');
      if (hasNoOpenBracket(line)) {
        nestedStatementStack.push('no brackets');
      }
    } else if (lineType == 'if statment') {
      result.concat('\n').concat(writeIfStatment(line, labelNum));
      nestedStatementStack.push('if statement');
      labelNumberStack.push(labelNum);
      labelNum++;
      if (hasNoOpenBracket(line)) {
        nestedStatementStack.push('no brackets')
      }
    } else if (lineType == 'for loop') {
      result.concat('\n').concat(writelabel(labelNum));
      loopJumpStack.push(labelNum);
      labelNum++;
      result.concat('\n').concat(writeForLoop(line, labelNum));
      nestedStatementStack.push('for loop');
      labelNumberStack.push(labelNum);
      labelNum++;
      forLoopIncrentStak.push(getForLoopInrement(line));
      if (hasNoOpenBracket(line)) {
        nestedStatementStack.push('no brackets');
      }
    } else if (lineType == 'instruction') {
      result.concat('\n').concat(writeInstruction(line));
      while (nestedStatementStack.lastIndexOf('no brackets') == (nestedStatementStack.length - 1)) {
        nestedStatementStack.pop();
        if (nestedStatementStack.lastIndexOf('for loop') == (nestedStatementStack.length - 1)) {
          result.concat('\n').concat(writeIncrement(forLoopIncrentStack.pop()));
          result.concat('\n').concat(writeJump(loopJumpStack.pop()));
        }
        result.concat('\n').concat(writeLabel(labelNumberStack.pop()));
        nestedStatementStack.pop();
      }
    } else if (lineType == 'close bracket') {
      if (nestedStatementStack.length > 0) {
        if (nestedStatementStack.lastIndexOf('for loop') == (nestedStatementStack.length - 1)) {
          result.concat('\n').concat(writeIncrement(forLoopIncrentStack.pop));
          result.concat('\n').concat(writeJump(loopJumpStack.pop()));
        }
        result.concat('\n').concat(WriteLabel(labelNumberStack.pop()));
        nestedStatementStack.pop();
        while (nestedStatementStack.lastIndexOf('no brackets') == (nestedStatementStack.length - 1)) {
          nestedStatementStack.pop();
          if (nestedStatementStack.lastIndexOf('for loop') == (nestedStatementStack.length - 1)) {
            result.concat('\n').concat(writeIncrement(forLoopIncrentStack.pop));
            result.concat('\n').concat(writeJump(loopJumpStack.pop()));
          }
          result.concat('\n').concat(WriteLabel(labelNumberStack.pop()))
          nestedStatementStack.pop();
        }
      } else {
        result.concat('\n').concat(WriteEndOfFunction(returnType)) //no nested statement means end of function
      }
    }
  }
  return result;
}

function getForLoopInrement(line) {
  var part1RegEx = /.*;.*;\s*/; //part before the increment
  var part2RegEx = /\s*\).*/; //part after the increment
  return line.replace(part1RegEx, "").replace(part2RegEx, ""); //returns the increment part
}

function hasNoOpenBracket(line) {
  return !(/.*\{/.test(line));
}

function writeIncrement(increment) {
  //TODO write the for loop increment
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

function writeLabel(labelNum) {
  return `L${labelNum}:`;
}

function writeJump(labelNum) {
  //TODO write a jump instruction to the label number
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

function getMemSize(cppCode) {
  //TODO return the amount of memory needed for the function. Difficulty level: hard
	var findInitializedArray = /[A-Za-z]+\[\d+\]/;
	var foundArray = cppCode.match(findInitializedArray);
	// console.log(foundArray[0]);
	var determineMemory = foundArray[0].match(/\d+/)[0];
	var memoryNeeded = 0;
	if(determineMemory == (0 || 1)){memoryNeeded = 16;}
	else if (determineMemory == 3 || determineMemory == 4 || determineMemory == 5 || determineMemory == 6) {memoryNeeded = 16 * 2;}
	else if (determineMemory == 7 || determineMemory == 8 || determineMemory == 9 || determineMemory == 10)	{memoryNeeded = 16 * 3;}
  return memoryNeeded;
}

function WriteEndOfFunction(returnType) {
  //TODO writes the end of function depending on the return type
  return '';
}

// for 0, 1 it stayed at 16
// 3, 4, 5, 6 stayed at 32
// 7, 8, 9, 10 stayed at 48
// 11, 12, 13, 14 stayed at 64
