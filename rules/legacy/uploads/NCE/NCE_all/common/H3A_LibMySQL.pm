######################################################################################################
#       _Name_  collection/event/H3A/common/lib/H3A_LibMySQL.pm
######################################################################################################
# 
# MySQL functions
#
# Source Control:
#       1.0		2023-12-14	aignerma	<STORY>		initial version
#
######################################################################################################

######################################################################################################
# Name: GetByFilter 
# Parameters: a db handle
#             a table or view name
#             a filter condition
#             a result hash ref (where the result should be written to)
#             a column filter (array ref)
#             a undef or "CountOnly"
# Description: Fills the result hash by the result of the given database query and returns the number 
#              of rows as well the error message if any occurs. 
######################################################################################################
sub LibMySQL_GetByFilter_v2 {
    my ($mydbh, $table, $filter, $result_ref, $columns, $countOnly) = @_;
    my $rowcount = undef;
    $countOnly //= '';
    my $message = "";
    my $sth;

	my $trace = '  LibMySQL_GetByFilter_v2';
	$Log->Message('DEBUG', $trace ." started...") ;

    if ($mydbh) {
        #execute SQL
        my %rec = ();
        my $queryStartTime = [ Time::HiRes::gettimeofday( ) ];

        if ($countOnly eq 'CountOnly' ) {
            $sth = $mydbh->prepare("select count(*) from ".$table." where ".$filter,{PrintError => 0, RaiseError => 0}); 
            if (!$sth) {
                $message = "SQL-ERR001 in prepare: return code: " . $mydbh->errstr;
                $Log->Message('ERROR', $trace . " " . $message);
            } else {
                if ($sth->execute()) {
                    #$sth->bind_columns( map {\$rec{$_}} @columns );
                    ($rowcount) = $sth->fetchrow_array();
                } else {
                    $message = "SQL-ERR002 in execute: error msg: " . $sth->errstr;
                    $Log->Message('ERROR', $trace . " " . $message);
                }       
                $sth->finish;
            }       
        } else {
        	$sth = $mydbh->prepare("select ".join(',',@$columns)." from ".$table." where ".$filter,{PrintError => 0, RaiseError => 0});
            # if ($table=~/timouttest/ ) {
            #       $sth = $mydbh->prepare("select count(*) from (SELECT A.*, B.* FROM OBJ_OSIRIS_SITEDATA_V2 A CROSS JOIN OBJ_OSIRIS_SITEDATA_V2 B)",{PrintError => 0, RaiseError => 0});
            #}

            if (!$sth) {
                $message = "SQL-ERR003 in prepare: return code: " . $mydbh->errstr;
                $Log->Message('ERROR', $trace . " " . $message);
            } else {
                if ($sth->execute()) {
                #fetch lines
                while (my $row = $sth->fetchrow_hashref) {
                    push @$result_ref, $row;
                    $rowcount++;
                }
                $rowcount=0 if (!defined $rowcount);
                } else {
                    $message = "SQL-ERR004 in execute: error msg: " . $sth->errstr;
                    $Log->Message('ERROR', $trace . " " . $message);
                }
                $sth->finish;
            }               
        }       
        my $elapsed_time = Time::HiRes::tv_interval($queryStartTime);
        $Log->Message('DEBUG', $trace . ": Querytime of table " . $table . ": " . $elapsed_time . " Received rows: " . $rowcount);
    } else {  
        $message = "DB-ERR001: Not able to connect to DB. Error: " . DBI->errstr;
        $Log->Message('ERROR', $trace . " " . $message);
    }
	
	$Log->Message('DEBUG', $trace ." ...done") ;
    return ($rowcount, $message);
}

######################################################################################################
# Name: LibMySQL_GetDBH_v2 
# Parameters: -) a hash refrence for a mysql database handle object.
# Description: Handles the db connection check for a single DCI DBH and set/update the "dbh" of the given DATASOURCE hash ref. 
######################################################################################################
sub LibMySQL_GetDBH_v2 {
        my $dsRef = shift ;

        my $trace = '  LibMySQL_GetDBH_v2';

        $Log->Message('DEBUG', $trace ." started...") ;
		
        $ShardID //= 1;
        
		unless (defined ($dsRef->{dbh})) {
			$Log->Message('DEBUG', "$trace CONNECTING to DCI. ShardID: '".$ShardID."'");
            $dsRef->{dbh} = DBConnect($Config, 'Event', {AutoCommit => 1, ShardID => $ShardID});
		}

		if ((defined($dsRef->{dbh})) && (!($dsRef->{dbh})->ping)) {
			$Log->Message('WARN', "$trace Connection to DCI down, attempting to RECONNECT.") ;
            $dsRef->{dbh}->disconnect;
            undef $dsRef->{dbh} ;
			$dsRef->{dbh} = DBConnect($Config, 'Event', {AutoCommit => 1, ShardID => $ShardID});

        }
        $Log->Message('DEBUG', $trace ." ...done") ;
}

######################################################################################################
# Name: LibMySQL_CallStoredProcedure 
# Parameters: -) name of a valid Mechanization
# Description: Executes a stored procedure without parameters
######################################################################################################
sub LibMySQL_CallStoredProcedure {
	my $dsRef = shift ;
    my $mechanization = shift;
    
    my $rc = 1;
    my $message = "";

	my $trace = '  LibMySQL_CallStoredProcedure';
	$Log->Message('DEBUG', $trace ." started...") ;

	if ($dsRef) {
        my $sth = $dsRef->prepare('CALL ' . $mechanization);
        
        if (!$sth) {
            $message = "SQL-ERR01 in prepare: return code: " . $myDBH->errstr;
            $Log->Message('ERROR', $trace . " " . $message);
        } else {
        	if ($sth->execute()) {
            	$message = "Stored Procedure '".$mechanization."' executed successfully. Affected rows: " . $sth->rows;
                $rc = 0;
                $Log->Message('INFO', $trace . " " . $message); 
            } else {
                $message = "SQL-ERR02 in execute: error msg: " . $sth->errstr;
                $Log->Message('ERROR', $trace . " " . $message);
            }
            $sth->finish;
        }
	} else {
		$message = "DB-ERR001: Not able to connect to DB. No valid database handle given. Error: " . DBI->errstr;
        $Log->Message('ERROR', $trace . " " . $message);
	}

	$Log->Message('DEBUG', $trace ." ...done") ;
    return ($rc, $message);
}

1;